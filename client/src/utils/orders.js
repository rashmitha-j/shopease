// Display helpers for orders (labels, colours, dates) and the checkout price estimate.

// Mirrors server/utils/pricing.js. Only used to show an estimate; the server calculates the real total.
export const FREE_SHIPPING_THRESHOLD = 999;
const SHIPPING_FEE = 49;
export const estimateShipping = (itemsTotal) => (itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE);

export const STATUS_INFO = {
  awaiting_payment: { label: 'Awaiting payment', className: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-800' },
  shipped: { label: 'Shipped', className: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-200 text-slate-700' },
};

export const PAYMENT_METHOD_LABELS = { razorpay: 'Online (Razorpay)', cod: 'Cash on delivery' };

// "65f1c2...a9b3e1" -> "#A9B3E1": short enough to read out, unique enough in practice
export const shortOrderId = (id) => `#${String(id).slice(-6).toUpperCase()}`;

const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDateTime = (value) => dateFormat.format(new Date(value));

// A paid order that ended up cancelled (e.g. payment arrived after it expired) needs a refund
export const needsRefund = (order) => order.status === 'cancelled' && order.paymentStatus === 'paid';

export const canCancel = (order) =>
  ['awaiting_payment', 'confirmed'].includes(order.status) && order.paymentStatus !== 'paid';
