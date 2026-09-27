import Order from '../models/Order.js';
import { toPaise } from '../utils/pricing.js';

// Records a successful Razorpay payment against our order. Shared by the browser's
// verify-payment call and the Razorpay webhook, so both paths behave identically.
// Callers must have verified the payment's authenticity (signature) first.
//
// Every change is a single conditional update, so calling this again, or from both
// paths at the same time, can never confirm an order twice. Stock is never touched:
// it was reserved when the order was placed.
//
// `expected` ({ amount in paise, currency }) is optional; the webhook passes it so a
// payment for the wrong amount or currency never confirms an order.
//
// Returns { result, order } where result is one of:
//   'paid'            awaiting_payment -> confirmed + paid (the only status change made here)
//   'already_paid'    already recorded with this payment id: nothing to do (duplicates, retries)
//   'refund_due'      the order was cancelled/expired first: payment recorded as paid + cancelled
//   'conflict'        the order is already paid with a different payment id: nothing changed
//   'amount_mismatch' amount or currency doesn't match the order: nothing changed
//   'not_payable'     any other state: nothing changed
//   'not_found'       no order has this Razorpay order id
export async function recordRazorpayPayment({ razorpayOrderId, paymentId, expected }) {
  const order = await Order.findOne({ 'razorpay.orderId': razorpayOrderId });
  if (!order) return { result: 'not_found', order: null };

  if (expected && (expected.amount !== toPaise(order.totalAmount) || expected.currency !== 'INR')) {
    return { result: 'amount_mismatch', order };
  }

  // Only an order still awaiting payment can be marked paid. The status check makes this
  // safe against the order being cancelled/expired, or paid through the other path, meanwhile.
  const paid = await Order.findOneAndUpdate(
    { _id: order._id, status: 'awaiting_payment' },
    { $set: { status: 'confirmed', paymentStatus: 'paid', paidAt: new Date(), 'razorpay.paymentId': paymentId } },
    { new: true }
  );
  if (paid) return { result: 'paid', order: paid };

  const latest = await Order.findById(order._id);
  const alreadyPaid = (o) => ({ result: o.razorpay?.paymentId === paymentId ? 'already_paid' : 'conflict', order: o });

  if (latest.paymentStatus === 'paid') return alreadyPaid(latest);

  // The order expired or was cancelled before payment was confirmed. Record the payment
  // so it can be refunded (a paid + cancelled order means "refund needed").
  if (latest.status === 'cancelled') {
    const recorded = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: { $ne: 'paid' } },
      { $set: { paymentStatus: 'paid', paidAt: new Date(), 'razorpay.paymentId': paymentId } },
      { new: true }
    );
    if (recorded) return { result: 'refund_due', order: recorded };
    return alreadyPaid(await Order.findById(order._id)); // recorded by the other path just now
  }

  return { result: 'not_payable', order: latest };
}
