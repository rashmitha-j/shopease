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

// timingSafeEqual avoids leaking how many characters of a signature matched
const signaturesMatch = (expected, received) => {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Razorpay signs "<razorpay_order_id>|<razorpay_payment_id>" with the key secret (HMAC-SHA256).
// A matching signature proves the payment details really came from Razorpay.
export function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature }) {
  if (![razorpayOrderId, razorpayPaymentId, signature].every((v) => typeof v === 'string' && v)) return false;

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return signaturesMatch(expected, signature);
}

// Webhooks use their own secret, set when creating the webhook in the Razorpay dashboard
export const isWebhookConfigured = () => Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);

// Razorpay signs the exact raw request body (HMAC-SHA256 with the webhook secret) and sends
// the result in the X-Razorpay-Signature header. The body must not be re-serialised first.
export function verifyWebhookSignature(rawBody, signature) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !signature) return false;

  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return signaturesMatch(expected, signature);
}
