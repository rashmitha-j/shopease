import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  app,
  Order,
  request,
  startDatabase,
  stopDatabase,
  clearDatabase,
  createUser,
  createProduct,
  stockOf,
  validAddress,
  razorpaySignature,
  fakeRazorpay,
} from './helpers.js';
import { setRazorpayClient } from '../utils/razorpay.js';
import { releaseExpiredOrders } from '../jobs/releaseExpiredOrders.js';

let customer;
let razorpay;

before(startDatabase);
after(stopDatabase);
beforeEach(async () => {
  await clearDatabase();
  customer = await createUser();
  razorpay = fakeRazorpay();
  setRazorpayClient(razorpay);
  process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
  process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-secret';
});

// Makes orders look older. Goes through the raw collection because Mongoose treats
// createdAt as immutable and silently drops updates to it.
const backdate = (ids, minutes) =>
  Order.collection.updateMany(
    { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(String(id))) } },
    { $set: { createdAt: new Date(Date.now() - minutes * 60 * 1000) } }
  );

const placeOrder = (auth, body) => request(app).post('/api/orders').set('Authorization', auth).send(body);
const orderBody = (items, paymentMethod = 'cod') => ({ items, shippingAddress: validAddress, paymentMethod });

describe('POST /api/orders (cash on delivery)', () => {
  test('requires login', async () => {
    const res = await request(app).post('/api/orders').send({});
    assert.equal(res.status, 401);
  });

  test('creates a confirmed order, reserves stock and uses database prices', async () => {
    const p = await createProduct({ price: 300, stock: 5 });
    // A client-supplied price must be ignored
    const res = await placeOrder(customer.auth, orderBody([{ productId: p._id, quantity: 2, price: 1 }]));

    assert.equal(res.status, 201, res.body.message);
    const { order } = res.body;
    assert.equal(order.status, 'confirmed');
    assert.equal(order.paymentStatus, 'pending');
    assert.equal(order.items[0].price, 300);
    assert.equal(order.itemsTotal, 600);
    assert.equal(order.shippingFee, 49); // under ₹999
    assert.equal(order.totalAmount, 649);
    assert.equal(order.shippingAddress.phone, '9876543210'); // normalised
    assert.equal(await stockOf(p), 3);
  });

  test('shipping is free from ₹999 and duplicate lines are merged', async () => {
    const p = await createProduct({ price: 333, stock: 10 });
    const res = await placeOrder(
      customer.auth,
      orderBody([
        { productId: p._id, quantity: 1 },
        { productId: p._id, quantity: 2 },
      ])
    );
    assert.equal(res.status, 201, res.body.message);
    assert.equal(res.body.order.items.length, 1);
    assert.equal(res.body.order.items[0].quantity, 3);
    assert.equal(res.body.order.itemsTotal, 999);
    assert.equal(res.body.order.shippingFee, 0);
    assert.equal(await stockOf(p), 7);
  });

  test('rejects invalid input with clear messages', async () => {
    const p = await createProduct();
    const cases = [
      [orderBody([]), /cart is empty/],
      [orderBody([{ productId: 'abc', quantity: 1 }]), /Invalid product/],
      [orderBody([{ productId: p._id, quantity: 0 }]), /at least 1/],
      [orderBody([{ productId: p._id, quantity: 1.5 }]), /whole numbers/],
      [orderBody([{ productId: p._id, quantity: 11 }]), /at most 10/],
      [orderBody([{ productId: p._id, quantity: 1 }], 'paypal'), /razorpay or cod/],
      [{ ...orderBody([{ productId: p._id, quantity: 1 }]), shippingAddress: { ...validAddress, phone: '12345' } }, /10-digit mobile/],
      [{ ...orderBody([{ productId: p._id, quantity: 1 }]), shippingAddress: { ...validAddress, postalCode: '0123' } }, /PIN code/],
      [{ ...orderBody([{ productId: p._id, quantity: 1 }]), shippingAddress: undefined }, /Shipping address is required/],
    ];
    for (const [body, message] of cases) {
      const res = await placeOrder(customer.auth, body);
      assert.equal(res.status, 400, `${JSON.stringify(body.items)} -> ${res.status} ${res.body.message}`);
      assert.match(res.body.message, message);
    }
    // Nothing was reserved by the failed attempts (including the invalid-address ones)
    assert.equal(await stockOf(p), 10);
    assert.equal(await Order.countDocuments(), 0);
  });

  test('not enough stock -> 409 and no item is reserved (transaction rollback)', async () => {
    const plenty = await createProduct({ stock: 10 });
    const scarce = await createProduct({ name: 'Scarce Thing', stock: 1 });
    const res = await placeOrder(
      customer.auth,
      orderBody([
        { productId: plenty._id, quantity: 2 },
        { productId: scarce._id, quantity: 3 },
      ])
    );
    assert.equal(res.status, 409);
    assert.equal(res.body.message, 'Only 1 of Scarce Thing left in stock');
    assert.equal(await stockOf(plenty), 10); // the first item's reservation was rolled back
    assert.equal(await Order.countDocuments(), 0);
  });

  test('deleted product -> 409', async () => {
    const p = await createProduct();
    await p.deleteOne();
    const res = await placeOrder(customer.auth, orderBody([{ productId: p._id, quantity: 1 }]));
    assert.equal(res.status, 409);
  });

  test('two customers buying the last item at once: exactly one succeeds', async () => {
    const other = await createUser();
    const last = await createProduct({ stock: 1 });
    const results = await Promise.all([
      placeOrder(customer.auth, orderBody([{ productId: last._id, quantity: 1 }])),
      placeOrder(other.auth, orderBody([{ productId: last._id, quantity: 1 }])),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await stockOf(last), 0);
    assert.equal(await Order.countDocuments(), 1);
  });
});

describe('Razorpay payments', () => {
  const placeRazorpayOrder = async (price = 1399, quantity = 1) => {
    const p = await createProduct({ price, stock: 5 });
    const res = await placeOrder(customer.auth, orderBody([{ productId: p._id, quantity }], 'razorpay'));
    assert.equal(res.status, 201, res.body.message);
    return { product: p, ...res.body };
  };
  const verify = (auth, orderId, body) =>
    request(app).post(`/api/orders/${orderId}/verify-payment`).set('Authorization', auth).send(body);
  const paymentBody = (rzpOrderId, paymentId = 'pay_test123') => ({
    razorpay_order_id: rzpOrderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: razorpaySignature(rzpOrderId, paymentId),
  });

  test('creates an order awaiting payment and a Razorpay order in paise', async () => {
    const { order, razorpay: rzp, product } = await placeRazorpayOrder(1399);
    assert.equal(order.status, 'awaiting_payment');
    assert.equal(order.totalAmount, 1399); // free shipping
    assert.deepEqual(rzp, { keyId: 'rzp_test_dummy', orderId: 'order_test1', amount: 139900, currency: 'INR' });
    assert.equal(razorpay.calls[0].receipt, `order_${order._id}`);
    assert.equal(order.razorpay.orderId, 'order_test1');
    assert.equal(await stockOf(product), 4); // reserved
  });

  test('without Razorpay keys -> 503 and nothing reserved', async () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    const p = await createProduct({ stock: 5 });
    const res = await placeOrder(customer.auth, orderBody([{ productId: p._id, quantity: 1 }], 'razorpay'));
    assert.equal(res.status, 503);
    assert.match(res.body.message, /cash on delivery/);
    assert.equal(await stockOf(p), 5);
  });

  test('if Razorpay fails, the order is cancelled and stock released', async () => {
    razorpay.fail = true;
    const p = await createProduct({ stock: 5 });
    const res = await placeOrder(customer.auth, orderBody([{ productId: p._id, quantity: 2 }], 'razorpay'));
    assert.equal(res.status, 502);
    assert.equal(await stockOf(p), 5);
    const order = await Order.findOne();
    assert.equal(order.status, 'cancelled');
  });

  test('valid signature marks the order paid; repeating is harmless', async () => {
    const { order } = await placeRazorpayOrder();
    const body = paymentBody('order_test1');

    const res = await verify(customer.auth, order._id, body);
    assert.equal(res.status, 200, res.body.message);
    assert.equal(res.body.order.paymentStatus, 'paid');
    assert.equal(res.body.order.status, 'confirmed');
    assert.equal(res.body.order.razorpay.paymentId, 'pay_test123');
    assert.ok(res.body.order.paidAt);

    const again = await verify(customer.auth, order._id, body);
    assert.equal(again.status, 200);
  });

  test('rejects forged or mismatched payment details', async () => {
    const { order } = await placeRazorpayOrder();
    const forged = { ...paymentBody('order_test1'), razorpay_signature: 'a'.repeat(64) };
    const otherOrder = paymentBody('order_someone_else');
    const tamperedPayment = { ...paymentBody('order_test1'), razorpay_payment_id: 'pay_different' };

    for (const body of [forged, otherOrder, tamperedPayment, {}]) {
      const res = await verify(customer.auth, order._id, body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal((await Order.findById(order._id)).paymentStatus, 'pending');
  });

  test("can't verify someone else's order", async () => {
    const { order } = await placeRazorpayOrder();
    const other = await createUser();
    const res = await verify(other.auth, order._id, paymentBody('order_test1'));
    assert.equal(res.status, 404);
  });

  test('payment confirmed after the order expired -> 409, payment recorded for refund', async () => {
    const { order, product } = await placeRazorpayOrder();
    await backdate([order._id], 31);
    assert.equal(await releaseExpiredOrders(), 1);
    assert.equal(await stockOf(product), 5);

    const res = await verify(customer.auth, order._id, paymentBody('order_test1'));
    assert.equal(res.status, 409);
    assert.match(res.body.message, /refunded/);
    const saved = await Order.findById(order._id);
    assert.equal(saved.status, 'cancelled');
    assert.equal(saved.paymentStatus, 'paid'); // paid + cancelled = needs a refund
    assert.equal(saved.razorpay.paymentId, 'pay_test123');
  });
});

describe('Cancelling and expiry', () => {
  test('owner can cancel an unpaid order once; stock is restored', async () => {
    const p = await createProduct({ stock: 5 });
    const { body } = await placeOrder(customer.auth, orderBody([{ productId: p._id, quantity: 3 }]));
    const cancel = () => request(app).post(`/api/orders/${body.order._id}/cancel`).set('Authorization', customer.auth);

    const res = await cancel();
    assert.equal(res.status, 200);
    assert.equal(res.body.order.status, 'cancelled');
    assert.equal(await stockOf(p), 5);

    const again = await cancel();
    assert.equal(again.status, 409);
    assert.equal(await stockOf(p), 5); // not restored twice
  });

  test("other users can't cancel it; paid orders can't be cancelled", async () => {
    const p = await createProduct({ price: 2000, stock: 5 });
    const { body } = await placeOrder(customer.auth, orderBody([{ productId: p._id, quantity: 1 }], 'razorpay'));
    const other = await createUser();
    const byOther = await request(app).post(`/api/orders/${body.order._id}/cancel`).set('Authorization', other.auth);
    assert.equal(byOther.status, 404);

    await request(app)
      .post(`/api/orders/${body.order._id}/verify-payment`)
      .set('Authorization', customer.auth)
      .send({
        razorpay_order_id: 'order_test1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: razorpaySignature('order_test1', 'pay_1'),
      });
    const paid = await request(app).post(`/api/orders/${body.order._id}/cancel`).set('Authorization', customer.auth);
    assert.equal(paid.status, 409);
    assert.equal(await stockOf(p), 4);
  });

  test('expiry job only releases unpaid online orders older than 30 minutes', async () => {
    const p = await createProduct({ stock: 10 });
    const place = async (method) =>
      (await placeOrder(customer.auth, orderBody([{ productId: p._id, quantity: 1 }], method))).body.order;
    const oldOnline = await place('razorpay');
    const newOnline = await place('razorpay');
    const oldCod = await place('cod');
    await backdate([oldOnline._id, oldCod._id], 31);
    assert.equal(await stockOf(p), 7);

    assert.equal(await releaseExpiredOrders(), 1);
    assert.equal((await Order.findById(oldOnline._id)).status, 'cancelled');
    assert.equal((await Order.findById(newOnline._id)).status, 'awaiting_payment');
    assert.equal((await Order.findById(oldCod._id)).status, 'confirmed');
    assert.equal(await stockOf(p), 8);
  });
});

describe('Reading orders', () => {
  test('GET /mine lists only my orders, newest first, paginated', async () => {
    const other = await createUser();
    const p = await createProduct({ stock: 10 });
    for (let i = 0; i < 3; i++) await placeOrder(customer.auth, orderBody([{ productId: p._id, quantity: 1 }]));
    await placeOrder(other.auth, orderBody([{ productId: p._id, quantity: 1 }]));

    const res = await request(app).get('/api/orders/mine?limit=2').set('Authorization', customer.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.pages, 2);
    assert.equal(res.body.orders.length, 2);
    assert.ok(res.body.orders.every((o) => o.user === customer.user._id));
    assert.ok(new Date(res.body.orders[0].createdAt) >= new Date(res.body.orders[1].createdAt));
  });

  test('GET /:id works for the owner and admins only', async () => {
    const p = await createProduct();
    const { body } = await placeOrder(customer.auth, orderBody([{ productId: p._id, quantity: 1 }]));
    const get = (auth) => request(app).get(`/api/orders/${body.order._id}`).set('Authorization', auth);

    assert.equal((await get(customer.auth)).status, 200);
    assert.equal((await get((await createUser()).auth)).status, 404);
    assert.equal((await get((await createUser({ role: 'admin' })).auth)).status, 200);
    const bad = await request(app).get('/api/orders/not-an-id').set('Authorization', customer.auth);
    assert.equal(bad.status, 400);
  });
});
