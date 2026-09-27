import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotals, roundMoney, shippingFeeFor, toPaise } from '../utils/pricing.js';
import { verifyPaymentSignature } from '../utils/razorpay.js';
import crypto from 'crypto';

test('shipping is free from ₹999', () => {
  assert.equal(shippingFeeFor(998.99), 49);
  assert.equal(shippingFeeFor(999), 0);
});

test('money rounding and paise conversion', () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(toPaise(0.1 + 0.2), 30);
  assert.equal(toPaise(1448), 144800);
  assert.equal(toPaise(19.99), 1999);
});

test('calculateTotals', () => {
  assert.deepEqual(calculateTotals([{ price: 199.5, quantity: 2 }, { price: 100, quantity: 1 }]), {
    itemsTotal: 499,
    shippingFee: 49,
    totalAmount: 548,
  });
});

test('verifyPaymentSignature', () => {
  process.env.RAZORPAY_KEY_SECRET = 'secret';
  const sig = crypto.createHmac('sha256', 'secret').update('order_1|pay_1').digest('hex');
  assert.equal(verifyPaymentSignature({ razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1', signature: sig }), true);
  assert.equal(verifyPaymentSignature({ razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_2', signature: sig }), false);
  assert.equal(verifyPaymentSignature({ razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1', signature: 'short' }), false);
  assert.equal(verifyPaymentSignature({ razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1', signature: ['x'] }), false);
  assert.equal(verifyPaymentSignature({}), false);
});
