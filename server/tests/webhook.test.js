import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
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

const URL = '/api/payments/razorpay/webhook';
const WEBHOOK_SECRET = 'test-webhook-secret';

let customer;
let admin;

before(startDatabase);
after(stopDatabase);
beforeEach(async () => {
  await clearDatabase();
  customer = await createUser();
  admin = await createUser({ role: 'admin' });
  setRazorpayClient(fakeRazorpay());
  process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
  process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

const sign = (raw, secret = WEBHOOK_SECRET) => crypto.createHmac('sha256', secret).update(raw).digest('hex');

// A Razorpay-style event for a payment on `rzpOrderId`
const paymentEvent = (type, { rzpOrderId, paymentId = 'pay_web1', amount, currency = 'INR' }) => ({
  entity: 'event',
  event: type,
  payload: {
    payment: { entity: { id: paymentId, entity: 'payment', order_id: rzpOrderId, amount, currency, status: type === 'payment.failed' ? 'failed' : 'captured' } },
    ...(type === 'order.paid' && { order: { entity: { id: rzpOrderId, amount, amount_paid: amount, status: 'paid' } } }),
  },
  created_at: 1700000000,
});

// Sends a webhook exactly like Razorpay: raw JSON body + signature of those bytes
function sendWebhook(body, { secret = WEBHOOK_SECRET, signature, raw, contentType = 'application/json', eventId = 'evt_1' } = {}) {
  const payload = raw ?? JSON.stringify(body);
  const req = request(app).post(URL).set('Content-Type', contentType).set('X-Razorpay-Event-Id', eventId);
  const sig = signature === undefined ? sign(payload, secret) : signature;
  if (sig !== null) req.set('X-Razorpay-Signature', sig);
  return req.send(payload);
}

// Places a real Razorpay order through the customer API; stock is reserved here, once
async function placeOnlineOrder({ price = 1399, stock = 5, quantity = 1 } = {}) {
  const product = await createProduct({ price, stock });
  const res = await request(app)
    .post('/api/orders')
    .set('Authorization', customer.auth)
    .send({ items: [{ productId: product._id, quantity }], shippingAddress: validAddress, paymentMethod: 'razorpay' });
  assert.equal(res.status, 201, res.body.message);
  return { order: res.body.order, rzp: res.body.razorpay, product };
}

// The browser's verify-payment call, signed with the key secret like Razorpay Checkout does
const browserVerify = (order, rzpOrderId, paymentId) =>
  request(app)
    .post(`/api/orders/${order._id}/verify-payment`)
    .set('Authorization', customer.auth)
    .send({ razorpay_order_id: rzpOrderId, razorpay_payment_id: paymentId, razorpay_signature: razorpaySignature(rzpOrderId, paymentId) });

const fresh = (order) => Order.findById(order._id);

describe('Signature verification', () => {
  test('valid signature on payment.captured confirms the order; stock is not reserved again', async () => {
    const { order, rzp, product } = await placeOnlineOrder({ quantity: 2 });
    assert.equal(await stockOf(product), 3); // reserved at checkout

    const res = await sendWebhook(paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, amount: rzp.amount }));
    assert.equal(res.status, 200);
    assert.equal(res.body.result, 'paid');

    const saved = await fresh(order);
    assert.equal(saved.status, 'confirmed');
    assert.equal(saved.paymentStatus, 'paid');
    assert.equal(saved.razorpay.paymentId, 'pay_web1');
    assert.ok(saved.paidAt);
    assert.equal(await stockOf(product), 3);
  });

  test('invalid, missing, wrong-secret and tampered signatures -> 400, nothing changes', async () => {
    const { order, rzp } = await placeOnlineOrder();
    const body = paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, amount: rzp.amount });
    const raw = JSON.stringify(body);
    const tampered = JSON.stringify({ ...body, payload: { payment: { entity: { ...body.payload.payment.entity, id: 'pay_evil' } } } });

    const attempts = [
      sendWebhook(body, { signature: 'a'.repeat(64) }), // wrong signature
      sendWebhook(body, { signature: null }), // missing header
      sendWebhook(body, { signature: 'short' }), // wrong length
      sendWebhook(body, { secret: 'test-razorpay-secret' }), // signed with the KEY secret, not the webhook secret
      sendWebhook(null, { raw: tampered, signature: sign(raw) }), // body changed after signing
      sendWebhook(null, { raw: `${raw} `, signature: sign(raw) }), // even whitespace matters: raw bytes are signed
    ];
    for (const res of await Promise.all(attempts)) {
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid webhook signature');
    }
    const saved = await fresh(order);
    assert.equal(saved.status, 'awaiting_payment');
    assert.equal(saved.paymentStatus, 'pending');
  });

  test('not configured -> 503 and nothing changes', async () => {
    const { order, rzp } = await placeOnlineOrder();
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const res = await sendWebhook(paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, amount: rzp.amount }), { secret: 'anything' });
    assert.equal(res.status, 503);
    assert.equal((await fresh(order)).status, 'awaiting_payment');
  });

  test('valid signature but invalid JSON -> 400; non-JSON content type -> 400', async () => {
    assert.equal((await sendWebhook(null, { raw: '{not json' })).status, 400);
    const { rzp } = await placeOnlineOrder();
    const res = await sendWebhook(paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, amount: rzp.amount }), { contentType: 'text/plain' });
    assert.equal(res.status, 400);
  });

  test('the rest of the API still parses JSON normally', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'wrongpass1' });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid email or password');
  });
});

describe('Duplicate and repeated events', () => {
  test('the same event delivered 3 times confirms once', async () => {
    const { order, rzp, product } = await placeOnlineOrder();
    const body = paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, amount: rzp.amount });
    const results = [];
    for (let i = 0; i < 3; i++) results.push((await sendWebhook(body)).body.result);
    assert.deepEqual(results, ['paid', 'already_paid', 'already_paid']);
    assert.equal((await fresh(order)).status, 'confirmed');
    assert.equal(await stockOf(product), 4);
  });

  test('5 identical events at the same moment: exactly one confirms, paidAt set once', async () => {
    const { order, rzp } = await placeOnlineOrder();
    const body = paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, amount: rzp.amount });
    const responses = await Promise.all(Array.from({ length: 5 }, () => sendWebhook(body)));
    assert.ok(responses.every((r) => r.status === 200));
    assert.deepEqual(responses.map((r) => r.body.result).sort(), ['already_paid', 'already_paid', 'already_paid', 'already_paid', 'paid']);
    const first = (await fresh(order)).paidAt.getTime();
    await sendWebhook(body);
    assert.equal((await fresh(order)).paidAt.getTime(), first);
  });

  test('payment.captured then order.paid for the same payment: confirmed once', async () => {
    const { order, rzp } = await placeOnlineOrder();
    const a = await sendWebhook(paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, amount: rzp.amount }), { eventId: 'evt_a' });
    const b = await sendWebhook(paymentEvent('order.paid', { rzpOrderId: rzp.orderId, amount: rzp.amount }), { eventId: 'evt_b' });
    assert.deepEqual([a.body.result, b.body.result], ['paid', 'already_paid']);
    assert.equal((await fresh(order)).paymentStatus, 'paid');
  });

  test('order.paid alone also confirms the order', async () => {
    const { order, rzp } = await placeOnlineOrder();
    const res = await sendWebhook(paymentEvent('order.paid', { rzpOrderId: rzp.orderId, amount: rzp.amount }));
    assert.equal(res.body.result, 'paid');
    assert.equal((await fresh(order)).status, 'confirmed');
  });
});

describe('Webhook and browser verification together', () => {
  test('webhook first, then the browser verify call: browser gets 200 with the paid order', async () => {
    const { order, rzp, product } = await placeOnlineOrder();
    await sendWebhook(paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, paymentId: 'pay_both', amount: rzp.amount }));
    const res = await browserVerify(order, rzp.orderId, 'pay_both');
    assert.equal(res.status, 200, res.body.message);
    assert.equal(res.body.order.paymentStatus, 'paid');
    assert.equal(res.body.order.status, 'confirmed');
    assert.equal(await stockOf(product), 4);
  });

  test('browser verify first, then the webhook: no-op', async () => {
    const { order, rzp } = await placeOnlineOrder();
    assert.equal((await browserVerify(order, rzp.orderId, 'pay_both')).status, 200);
    const paidAt = (await fresh(order)).paidAt.getTime();
    const res = await sendWebhook(paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, paymentId: 'pay_both', amount: rzp.amount }));
    assert.equal(res.body.result, 'already_paid');
    assert.equal((await fresh(order)).paidAt.getTime(), paidAt);
  });

  test('browser verify and webhook at the same moment: confirmed once', async () => {
    const { order, rzp } = await placeOnlineOrder();
    const [browser, hook] = await Promise.all([
      browserVerify(order, rzp.orderId, 'pay_race'),
      sendWebhook(paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, paymentId: 'pay_race', amount: rzp.amount })),
    ]);
    assert.equal(browser.status, 200);
    assert.ok(['paid', 'already_paid'].includes(hook.body.result));
    const saved = await fresh(order);
    assert.equal(saved.status, 'confirmed');
    assert.equal(saved.razorpay.paymentId, 'pay_race');
  });

  test('customer closed the tab after paying (no browser call): the webhook alone confirms it', async () => {
    const { order, rzp } = await placeOnlineOrder();
    await sendWebhook(paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, amount: rzp.amount }));
    // The 30-minute expiry job must now leave it alone
    await Order.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(String(order._id)) },
      { $set: { createdAt: new Date(Date.now() - 31 * 60 * 1000) } }
    );
    assert.equal(await releaseExpiredOrders(), 0);
    assert.equal((await fresh(order)).status, 'confirmed');
  });
});

describe('Order state safety', () => {
  test('payment after the order expired -> refund_due (paid + cancelled), stock not reserved again', async () => {
    const { order, rzp, product } = await placeOnlineOrder({ quantity: 2 });
    await Order.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(String(order._id)) },
      { $set: { createdAt: new Date(Date.now() - 31 * 60 * 1000) } }
    );
    assert.equal(await releaseExpiredOrders(), 1);
    assert.equal(await stockOf(product), 5); // released by the expiry job

    const body = paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, paymentId: 'pay_late', amount: rzp.amount });
    const res = await sendWebhook(body);
    assert.equal(res.status, 200);
    assert.equal(res.body.result, 'refund_due');
    const saved = await fresh(order);
    assert.equal(saved.status, 'cancelled');
    assert.equal(saved.paymentStatus, 'paid');
    assert.equal(saved.razorpay.paymentId, 'pay_late');
    assert.equal(await stockOf(product), 5);

    assert.equal((await sendWebhook(body)).body.result, 'already_paid'); // duplicate: no change
    // The browser flow still behaves as before for a late payment that is already recorded
    assert.equal((await browserVerify(order, rzp.orderId, 'pay_late')).status, 200);
    assert.equal((await fresh(order)).status, 'cancelled');
  });

  test('order cancelled by the store, then paid -> refund_due', async () => {
    const { order, rzp, product } = await placeOnlineOrder();
    const cancel = await request(app).patch(`/api/admin/orders/${order._id}/status`).set('Authorization', admin.auth).send({ status: 'cancelled' });
    assert.equal(cancel.status, 200);
    const res = await sendWebhook(paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, amount: rzp.amount }));
    assert.equal(res.body.result, 'refund_due');
    assert.equal((await fresh(order)).status, 'cancelled');
    assert.equal(await stockOf(product), 5);
  });

  test('a duplicate event for a shipped order changes nothing', async () => {
    const { order, rzp } = await placeOnlineOrder();
    const body = paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, amount: rzp.amount });
    await sendWebhook(body);
    await request(app).patch(`/api/admin/orders/${order._id}/status`).set('Authorization', admin.auth).send({ status: 'shipped' });
    assert.equal((await sendWebhook(body)).body.result, 'already_paid');
    assert.equal((await fresh(order)).status, 'shipped');
  });

  test('a different payment on an already-paid order -> conflict, nothing changes', async () => {
    const { order, rzp } = await placeOnlineOrder();
    await sendWebhook(paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, paymentId: 'pay_first', amount: rzp.amount }));
    const res = await sendWebhook(paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, paymentId: 'pay_second', amount: rzp.amount }));
    assert.equal(res.status, 200);
    assert.equal(res.body.result, 'conflict');
    assert.equal((await fresh(order)).razorpay.paymentId, 'pay_first');
  });

  test('amount or currency mismatch -> not confirmed', async () => {
    const { order, rzp } = await placeOnlineOrder();
    for (const change of [{ amount: rzp.amount - 1 }, { amount: rzp.amount * 10 }, { currency: 'USD' }, { amount: String(rzp.amount) }]) {
      const res = await sendWebhook(paymentEvent('payment.captured', { rzpOrderId: rzp.orderId, amount: rzp.amount, ...change }));
      assert.equal(res.status, 200);
      assert.equal(res.body.result, 'amount_mismatch', JSON.stringify(change));
    }
    const saved = await fresh(order);
    assert.equal(saved.status, 'awaiting_payment');
    assert.equal(saved.paymentStatus, 'pending');
  });

  test('unknown Razorpay order -> 200 not_found (so Razorpay stops retrying)', async () => {
    const res = await sendWebhook(paymentEvent('payment.captured', { rzpOrderId: 'order_not_ours', amount: 100 }));
    assert.equal(res.status, 200);
    assert.equal(res.body.result, 'not_found');
  });

  test('payment.failed, unhandled events and events without payment details -> 200, no change', async () => {
    const { order, rzp } = await placeOnlineOrder();
    const bodies = [
      paymentEvent('payment.failed', { rzpOrderId: rzp.orderId, amount: rzp.amount }),
      paymentEvent('payment.authorized', { rzpOrderId: rzp.orderId, amount: rzp.amount }), // not captured yet
      { entity: 'event', event: 'refund.processed', payload: {} },
      { entity: 'event', event: 'payment.captured', payload: {} },
    ];
    for (const body of bodies) {
      const res = await sendWebhook(body);
      assert.equal(res.status, 200);
      assert.equal(res.body.result, 'ignored');
    }
    assert.equal((await fresh(order)).status, 'awaiting_payment');
  });

  test('cash on delivery orders are never affected', async () => {
    const product = await createProduct({ stock: 5 });
    const placed = await request(app)
      .post('/api/orders')
      .set('Authorization', customer.auth)
      .send({ items: [{ productId: product._id, quantity: 1 }], shippingAddress: validAddress, paymentMethod: 'cod' });
    const res = await sendWebhook(paymentEvent('payment.captured', { rzpOrderId: String(placed.body.order._id), amount: 999 }));
    assert.equal(res.body.result, 'not_found');
    const saved = await fresh(placed.body.order);
    assert.equal(saved.status, 'confirmed');
    assert.equal(saved.paymentStatus, 'pending');
    assert.equal(await stockOf(product), 4);
  });
});
