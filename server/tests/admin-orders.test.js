import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
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

let admin;
let customer;

before(startDatabase);
after(stopDatabase);
beforeEach(async () => {
  await clearDatabase();
  admin = await createUser({ role: 'admin' });
  customer = await createUser();
  setRazorpayClient(fakeRazorpay());
  process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
  process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-secret';
});

const as = (req, auth) => (auth ? req.set('Authorization', auth) : req);
const list = (query, auth) => as(request(app).get(`/api/admin/orders${query}`), auth);
const detail = (id, auth) => as(request(app).get(`/api/admin/orders/${id}`), auth);
const setStatus = (id, status, auth) => as(request(app).patch(`/api/admin/orders/${id}/status`).send({ status }), auth);

// Places an order through the real customer API
async function placeOrder({ user = customer, product, quantity = 1, method = 'cod', address = validAddress } = {}) {
  const p = product ?? (await createProduct({ price: 500, stock: 10 }));
  const res = await request(app)
    .post('/api/orders')
    .set('Authorization', user.auth)
    .send({ items: [{ productId: p._id, quantity }], shippingAddress: address, paymentMethod: method });
  assert.equal(res.status, 201, res.body.message);
  return { order: res.body.order, product: p };
}

async function payOnline(order) {
  const res = await request(app)
    .post(`/api/orders/${order._id}/verify-payment`)
    .set('Authorization', customer.auth)
    .send({
      razorpay_order_id: order.razorpay.orderId,
      razorpay_payment_id: 'pay_1',
      razorpay_signature: razorpaySignature(order.razorpay.orderId, 'pay_1'),
    });
  assert.equal(res.status, 200, res.body.message);
  return res.body.order;
}

describe('Admin order endpoints reject everyone else', () => {
  test('logged out -> 401, customers -> 403, nothing changes', async () => {
    const { order } = await placeOrder();
    for (const auth of [undefined, customer.auth]) {
      const expected = auth ? 403 : 401;
      assert.equal((await list('', auth)).status, expected);
      assert.equal((await detail(order._id, auth)).status, expected);
      assert.equal((await setStatus(order._id, 'shipped', auth)).status, expected);
    }
    assert.equal((await Order.findById(order._id)).status, 'confirmed');
  });

  test("customers still can't read other customers' orders through the customer API", async () => {
    const { order } = await placeOrder();
    const other = await createUser();
    const res = await request(app).get(`/api/orders/${order._id}`).set('Authorization', other.auth);
    assert.equal(res.status, 404);
  });
});

describe('GET /api/admin/orders', () => {
  test('lists all customers’ orders, newest first, with customer name and email', async () => {
    const other = await createUser();
    await placeOrder();
    await placeOrder({ user: other });
    const res = await list('', admin.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 2);
    assert.equal(res.body.orders[0].user.email, other.user.email);
    assert.equal(res.body.orders[1].user.name, customer.user.name);
    assert.equal(res.body.orders[0].user.password, undefined);
  });

  test('filters by status, payment status and payment method', async () => {
    await placeOrder(); // cod, confirmed, pending
    const { order: online } = await placeOrder({ method: 'razorpay' }); // awaiting_payment
    const { order: paidOnline } = await placeOrder({ method: 'razorpay' });
    await payOnline(paidOnline); // confirmed, paid

    const ids = async (query) => (await list(query, admin.auth)).body.orders.map((o) => o._id).sort();
    assert.deepEqual(await ids('?status=awaiting_payment'), [online._id]);
    assert.equal((await list('?status=confirmed', admin.auth)).body.total, 2);
    assert.deepEqual(await ids('?paymentStatus=paid'), [paidOnline._id]);
    assert.equal((await list('?paymentMethod=cod', admin.auth)).body.total, 1);
    assert.deepEqual(await ids('?status=confirmed&paymentMethod=razorpay'), [paidOnline._id]);
  });

  test('rejects unknown filter values', async () => {
    for (const q of ['?status=lost', '?paymentStatus=refunded', '?paymentMethod=paypal']) {
      assert.equal((await list(q, admin.auth)).status, 400, q);
    }
  });

  test('searches by full order id, short "#" id, customer email/name and shipping phone', async () => {
    const other = await createUser();
    const { order: mine } = await placeOrder();
    const { order: theirs } = await placeOrder({ user: other, address: { ...validAddress, fullName: 'Priya Sharma', phone: '9123456780' } });
    const find = async (q) => (await list(`?q=${encodeURIComponent(q)}`, admin.auth)).body.orders.map((o) => o._id);

    assert.deepEqual(await find(mine._id), [mine._id]);
    assert.deepEqual(await find(`#${theirs._id.slice(-6).toUpperCase()}`), [theirs._id]);
    assert.deepEqual(await find(other.user.email), [theirs._id]);
    assert.deepEqual(await find(customer.user.name), [mine._id]);
    assert.deepEqual(await find('priya'), [theirs._id]);
    assert.deepEqual(await find('91234'), [theirs._id]);
    assert.deepEqual(await find('nobody-matches-this'), []);
  });

  test('paginates', async () => {
    const p = await createProduct({ stock: 50 });
    for (let i = 0; i < 5; i++) await placeOrder({ product: p });
    const res = await list('?limit=2&page=3', admin.auth);
    assert.equal(res.body.total, 5);
    assert.equal(res.body.pages, 3);
    assert.equal(res.body.orders.length, 1);
  });
});

describe('GET /api/admin/orders/:id', () => {
  test('returns the order with customer details and allowed next statuses', async () => {
    const { order } = await placeOrder();
    const res = await detail(order._id, admin.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.order.user.email, customer.user.email);
    assert.deepEqual(res.body.order.allowedStatuses, ['shipped', 'cancelled']);
  });

  test('unknown id -> 404, bad id -> 400', async () => {
    assert.equal((await detail('64b000000000000000000000', admin.auth)).status, 404);
    assert.equal((await detail('nope', admin.auth)).status, 400);
  });
});

describe('PATCH /api/admin/orders/:id/status', () => {
  test('COD order: confirmed -> shipped -> delivered, then final', async () => {
    const { order } = await placeOrder();
    let res = await setStatus(order._id, 'shipped', admin.auth);
    assert.equal(res.status, 200, res.body.message);
    assert.equal(res.body.order.status, 'shipped');
    assert.deepEqual(res.body.order.allowedStatuses, ['delivered']);

    res = await setStatus(order._id, 'delivered', admin.auth);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.order.allowedStatuses, []);
    assert.equal(res.body.order.paymentStatus, 'pending'); // payment is not touched

    // The customer sees the new status
    const mine = await request(app).get(`/api/orders/${order._id}`).set('Authorization', customer.auth);
    assert.equal(mine.body.order.status, 'delivered');
  });

  test('invalid transitions -> 409 and nothing changes', async () => {
    const { order: cod } = await placeOrder();
    const { order: online } = await placeOrder({ method: 'razorpay' });

    const cases = [
      [cod._id, 'delivered', /from confirmed to delivered/], // must ship first
      [cod._id, 'awaiting_payment', /from confirmed to awaiting payment/],
      [cod._id, 'confirmed', /from confirmed to confirmed/],
      [online._id, 'shipped', /from awaiting payment to shipped/], // not paid yet
    ];
    for (const [id, status, message] of cases) {
      const res = await setStatus(id, status, admin.auth);
      assert.equal(res.status, 409, `${status}: ${res.body.message}`);
      assert.match(res.body.message, message);
    }
    await setStatus(cod._id, 'shipped', admin.auth);
    for (const status of ['cancelled', 'confirmed']) {
      assert.equal((await setStatus(cod._id, status, admin.auth)).status, 409, `shipped -> ${status}`);
    }
    await setStatus(cod._id, 'delivered', admin.auth);
    assert.equal((await setStatus(cod._id, 'shipped', admin.auth)).status, 409);
    assert.equal((await Order.findById(cod._id)).status, 'delivered');
    assert.equal((await Order.findById(online._id)).status, 'awaiting_payment');
  });

  test('unknown status -> 400; unknown order -> 404', async () => {
    const { order } = await placeOrder();
    assert.equal((await setStatus(order._id, 'lost', admin.auth)).status, 400);
    assert.equal((await setStatus('64b000000000000000000000', 'shipped', admin.auth)).status, 404);
  });

  test('cancelling an unpaid COD order restores stock exactly once', async () => {
    const p = await createProduct({ stock: 5 });
    const { order } = await placeOrder({ product: p, quantity: 3 });
    assert.equal(await stockOf(p), 2);

    const res = await setStatus(order._id, 'cancelled', admin.auth);
    assert.equal(res.status, 200, res.body.message);
    assert.equal(res.body.order.status, 'cancelled');
    assert.equal(res.body.order.cancelReason, 'Cancelled by the store');
    assert.equal(await stockOf(p), 5);

    assert.equal((await setStatus(order._id, 'cancelled', admin.auth)).status, 409);
    const byCustomer = await request(app).post(`/api/orders/${order._id}/cancel`).set('Authorization', customer.auth);
    assert.equal(byCustomer.status, 409);
    assert.equal(await stockOf(p), 5); // still not restored twice
  });

  test('cancelling an order awaiting payment restores stock; a late payment is then recorded for refund', async () => {
    const p = await createProduct({ stock: 5 });
    const { order } = await placeOrder({ product: p, quantity: 2, method: 'razorpay' });
    assert.equal((await setStatus(order._id, 'cancelled', admin.auth)).status, 200);
    assert.equal(await stockOf(p), 5);

    // Existing customer payment logic is unchanged: the late payment gets the refund message
    const res = await request(app)
      .post(`/api/orders/${order._id}/verify-payment`)
      .set('Authorization', customer.auth)
      .send({
        razorpay_order_id: order.razorpay.orderId,
        razorpay_payment_id: 'pay_late',
        razorpay_signature: razorpaySignature(order.razorpay.orderId, 'pay_late'),
      });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /refunded/);
    assert.equal(await stockOf(p), 5);
  });

  test("paid orders can't be cancelled (no refunds yet) but can be shipped", async () => {
    const p = await createProduct({ stock: 5 });
    const { order } = await placeOrder({ product: p, method: 'razorpay' });
    await payOnline(order);

    const cancel = await setStatus(order._id, 'cancelled', admin.auth);
    assert.equal(cancel.status, 409);
    assert.match(cancel.body.message, /refunds aren’t supported/);
    assert.equal(await stockOf(p), 4);

    const ship = await setStatus(order._id, 'shipped', admin.auth);
    assert.equal(ship.status, 200);
    assert.equal(ship.body.order.paymentStatus, 'paid');
  });

  test('after the store ships an order the customer can no longer cancel it', async () => {
    const { order } = await placeOrder();
    await setStatus(order._id, 'shipped', admin.auth);
    const res = await request(app).post(`/api/orders/${order._id}/cancel`).set('Authorization', customer.auth);
    assert.equal(res.status, 409);
  });
});
