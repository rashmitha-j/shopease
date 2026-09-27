import AppError from '../utils/AppError.js';
import { isWebhookConfigured, verifyWebhookSignature } from '../utils/razorpay.js';
import { recordRazorpayPayment } from '../services/payments.js';

// Both mean "the money was captured". Razorpay usually sends both for one payment;
// whichever arrives second is a no-op.
const PAYMENT_CAPTURED_EVENTS = new Set(['payment.captured', 'order.paid']);

const log = (message, details) => console.log(`[razorpay webhook] ${message}`, details);

// POST /api/payments/razorpay/webhook   (called by Razorpay, not by the browser)
// The route gives us the raw body (a Buffer): the signature covers the exact bytes Razorpay sent.
//
// Responses: 400 = not from Razorpay / malformed (nothing changed); 503 = not configured;
// 200 = handled or deliberately ignored (so Razorpay doesn't keep retrying);
// 500 (from the error handler) = temporary failure, e.g. database down: Razorpay retries later.
export const handleRazorpayWebhook = async (req, res) => {
  if (!isWebhookConfigured()) {
    console.error('[razorpay webhook] RAZORPAY_WEBHOOK_SECRET is not set; rejecting webhook');
    throw new AppError('Webhooks are not configured', 503);
  }

  // Only trust the payload after the signature check passes
  if (!verifyWebhookSignature(req.body, req.get('x-razorpay-signature'))) {
    throw new AppError('Invalid webhook signature', 400);
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    throw new AppError('Invalid webhook payload', 400);
  }

  const eventId = req.get('x-razorpay-event-id') ?? null;
  const type = event?.event;

  if (!PAYMENT_CAPTURED_EVENTS.has(type)) {
    // payment.failed: the order stays awaiting_payment; the customer can retry in the
    // Checkout window and unpaid orders are cancelled by the expiry job, as before.
    if (type === 'payment.failed') log('payment failed', { eventId, razorpayOrderId: event?.payload?.payment?.entity?.order_id });
    return res.json({ success: true, result: 'ignored' });
  }

  const payment = event.payload?.payment?.entity;
  if (typeof payment?.order_id !== 'string' || typeof payment?.id !== 'string') {
    log('event without payment details ignored', { eventId, type });
    return res.json({ success: true, result: 'ignored' });
  }

  const { result, order } = await recordRazorpayPayment({
    razorpayOrderId: payment.order_id,
    paymentId: payment.id,
    expected: { amount: payment.amount, currency: payment.currency },
  });

  if (!['paid', 'already_paid', 'not_found'].includes(result)) {
    // Needs a human: refund due, amount mismatch, or a second payment on a paid order
    log(`needs attention: ${result}`, {
      eventId,
      type,
      orderId: order?._id ? String(order._id) : null,
      razorpayOrderId: payment.order_id,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
    });
  }

  res.json({ success: true, result });
};
