import crypto from 'crypto';
import Razorpay from 'razorpay';

// Online payments are optional: without keys, cash on delivery still works.
export const isRazorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

let client = null;

const getClient = () => {
  client ??= new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  return client;
};

// Lets tests replace the real Razorpay API with a fake one
export const setRazorpayClient = (fake) => {
  client = fake;
};

// Creates a Razorpay order; the browser's Checkout window is opened with its id.
export const createRazorpayOrder = ({ amountPaise, receipt, notes }) =>
  getClient().orders.create({ amount: amountPaise, currency: 'INR', receipt, notes });

// Razorpay signs "<razorpay_order_id>|<razorpay_payment_id>" with the key secret (HMAC-SHA256).
// A matching signature proves the payment details really came from Razorpay.
// timingSafeEqual avoids leaking how many characters matched.
export function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature }) {
  if (![razorpayOrderId, razorpayPaymentId, signature].every((v) => typeof v === 'string' && v)) return false;

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
