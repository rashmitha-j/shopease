import mongoose from 'mongoose';
import Order, { ORDER_STATUSES, PAYMENT_METHODS } from '../models/Order.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { escapeRegex } from '../utils/strings.js';

const STATUS_LABELS = {
  awaiting_payment: 'awaiting payment',
  confirmed: 'confirmed',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

// The statuses an admin may move an order to next.
// - Unpaid orders can be cancelled (stock goes back via Order.cancelUnpaid).
// - Paid orders can't be cancelled here: that needs a refund, which isn't supported yet.
// - Online orders can't ship before they are paid (they stay awaiting_payment until then).
// - Shipped/delivered orders can't be cancelled (that would need a returns process).
export function allowedNextStatuses(order) {
  switch (order.status) {
    case 'awaiting_payment':
      return ['cancelled'];
    case 'confirmed':
      return order.paymentStatus === 'paid' ? ['shipped'] : ['shipped', 'cancelled'];
    case 'shipped':
      return ['delivered'];
    default:
      return []; // delivered and cancelled are final
  }
}

const withCustomer = (query) => query.populate('user', 'name email');
const toAdminJSON = (order) => ({ ...order.toJSON(), allowedStatuses: allowedNextStatuses(order) });

const queryString = (value) => (typeof value === 'string' ? value.trim() : '');

// GET /api/admin/orders?q=&status=&paymentStatus=&paymentMethod=&page=&limit=
// q matches an order id (full, or the short "#A1B2C3" form shown in the UI),
// the customer's name or email, or the name / phone on the shipping address.
export const listOrders = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const status = queryString(req.query.status);
  const paymentStatus = queryString(req.query.paymentStatus);
  const paymentMethod = queryString(req.query.paymentMethod);
  const q = queryString(req.query.q).replace(/^#/, '').slice(0, 100);

  const filter = {};
  if (status) {
    if (!ORDER_STATUSES.includes(status)) throw new AppError(`status must be one of: ${ORDER_STATUSES.join(', ')}`, 400);
    filter.status = status;
  }
  if (paymentStatus) {
    if (!['pending', 'paid'].includes(paymentStatus)) throw new AppError('paymentStatus must be pending or paid', 400);
    filter.paymentStatus = paymentStatus;
  }
  if (paymentMethod) {
    if (!PAYMENT_METHODS.includes(paymentMethod)) throw new AppError('paymentMethod must be razorpay or cod', 400);
    filter.paymentMethod = paymentMethod;
  }

  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    const customers = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select('_id').limit(200);
    const or = [
      { user: { $in: customers.map((u) => u._id) } },
      { 'shippingAddress.fullName': pattern },
      { 'shippingAddress.phone': pattern },
    ];
    if (mongoose.isValidObjectId(q) && q.length === 24) or.push({ _id: q });
    else if (/^[0-9a-f]{4,23}$/i.test(q)) {
      // Part of an id, e.g. the last 6 characters shown as "#A1B2C3"
      or.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: escapeRegex(q.toLowerCase()) } } });
    }
    filter.$or = or;
  }

  const [orders, total] = await Promise.all([
    withCustomer(Order.find(filter))
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({ success: true, orders, page, pages: Math.ceil(total / limit), total });
};

// GET /api/admin/orders/:id   -> the order with customer details and the allowed next statuses
export const getOrderForAdmin = async (req, res) => {
  const order = await withCustomer(Order.findById(req.params.id));
  if (!order) throw new AppError('Order not found', 404);
  res.json({ success: true, order: toAdminJSON(order) });
};

// PATCH /api/admin/orders/:id/status   { status }
export const updateOrderStatus = async (req, res) => {
  const { status } = req.body ?? {};
  if (!ORDER_STATUSES.includes(status)) throw new AppError(`status must be one of: ${ORDER_STATUSES.join(', ')}`, 400);

  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);

  if (!allowedNextStatuses(order).includes(status)) {
    const reason =
      status === 'cancelled' && order.paymentStatus === 'paid'
        ? ' Paid orders can’t be cancelled because refunds aren’t supported yet.'
        : '';
    throw new AppError(`Can’t change an order from ${STATUS_LABELS[order.status]} to ${STATUS_LABELS[status]}.${reason}`, 409);
  }

  let updated;
  if (status === 'cancelled') {
    // Reuses the customer/expiry cancel logic: one transaction that only succeeds for an
    // unpaid, cancellable order and restores its stock exactly once.
    updated = await Order.cancelUnpaid({ _id: order._id }, 'Cancelled by the store');
  } else {
    // Only move forward from the exact state we checked, so a payment or cancellation
    // happening at the same moment can't be overwritten.
    updated = await Order.findOneAndUpdate(
      { _id: order._id, status: order.status, paymentStatus: order.paymentStatus },
      { $set: { status } },
      { new: true, runValidators: true }
    );
  }
  if (!updated) throw new AppError('This order was changed by someone else. Reload it and try again.', 409);

  const fresh = await withCustomer(Order.findById(order._id));
  res.json({ success: true, order: toAdminJSON(fresh) });
};
