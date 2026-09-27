import mongoose from 'mongoose';
import Order, { PAYMENT_METHODS } from '../models/Order.js';
import Product from '../models/Product.js';
import AppError from '../utils/AppError.js';
import { MAX_ITEMS_PER_ORDER, MAX_QUANTITY_PER_ITEM, calculateTotals, toPaise } from '../utils/pricing.js';
import { recordRazorpayPayment } from '../services/payments.js';
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  verifyPaymentSignature,
} from '../utils/razorpay.js';

const ADDRESS_FIELDS = ['fullName', 'phone', 'line1', 'line2', 'city', 'state', 'postalCode', 'country'];

const pickAddress = (address) =>
  address && typeof address === 'object'
    ? Object.fromEntries(ADDRESS_FIELDS.filter((k) => address[k] !== undefined).map((k) => [k, String(address[k])]))
    : undefined;

// [{ productId, quantity }] -> Map(productId -> quantity), merging duplicates
function parseItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new AppError('Your cart is empty', 400);

  const quantities = new Map();
  for (const item of items) {
    const id = String(item?.productId ?? '');
    const qty = Number(item?.quantity);
    if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid product in cart', 400);
    if (!Number.isInteger(qty) || qty < 1) throw new AppError('Quantities must be whole numbers of at least 1', 400);
    quantities.set(id, (quantities.get(id) ?? 0) + qty);
  }

  if (quantities.size > MAX_ITEMS_PER_ORDER) {
    throw new AppError(`An order can contain at most ${MAX_ITEMS_PER_ORDER} different products`, 400);
  }
  for (const qty of quantities.values()) {
    if (qty > MAX_QUANTITY_PER_ITEM) {
      throw new AppError(`You can order at most ${MAX_QUANTITY_PER_ITEM} of each product`, 400);
    }
  }
  return quantities;
}

// POST /api/orders   { items: [{ productId, quantity }], shippingAddress, paymentMethod }
// Prices and totals always come from the database, never from the request.
export const createOrder = async (req, res) => {
  const { items, shippingAddress, paymentMethod } = req.body ?? {};

  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new AppError('Payment method must be razorpay or cod', 400);
  if (paymentMethod === 'razorpay' && !isRazorpayConfigured()) {
    throw new AppError('Online payments are not configured. Please choose cash on delivery.', 503);
  }
  const quantities = parseItems(items);

  // Reserve stock and save the order in one transaction: either every item is
  // reserved and the order exists, or nothing changes.
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      const products = await Product.find({ _id: { $in: [...quantities.keys()] } }).session(session);
      const byId = new Map(products.map((p) => [String(p._id), p]));

      const orderItems = [];
      for (const [id, quantity] of quantities) {
        const product = byId.get(id);
        if (!product) throw new AppError('A product in your cart is no longer available', 409);

        // The stock condition makes this safe against two customers buying the last item at once
        const { modifiedCount } = await Product.updateOne(
          { _id: id, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { session }
        );
        if (modifiedCount !== 1) {
          throw new AppError(
            product.stock > 0
              ? `Only ${product.stock} of ${product.name} left in stock`
              : `${product.name} is out of stock`,
            409
          );
        }

        orderItems.push({
          product: product._id,
          name: product.name,
          slug: product.slug,
          image: product.images[0]?.url ?? '',
          price: product.price,
          quantity,
        });
      }

      [order] = await Order.create(
        [
          {
            user: req.user._id,
            items: orderItems,
            shippingAddress: pickAddress(shippingAddress),
            ...calculateTotals(orderItems),
            paymentMethod,
            // Cash on delivery is confirmed straight away; online orders wait for payment
            status: paymentMethod === 'cod' ? 'confirmed' : 'awaiting_payment',
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  if (paymentMethod === 'cod') {
    return res.status(201).json({ success: true, order });
  }

  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder({
      amountPaise: toPaise(order.totalAmount),
      receipt: `order_${order._id}`,
      notes: { orderId: String(order._id) },
    });
  } catch (err) {
    console.error('Razorpay order creation failed:', err?.error?.description ?? err?.message ?? err);
    await Order.cancelUnpaid({ _id: order._id }, 'Payment could not be started');
    throw new AppError('Could not start the payment. Please try again.', 502);
  }

  order.razorpay.orderId = razorpayOrder.id;
  await order.save();

  res.status(201).json({
    success: true,
    order,
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    },
  });
};

// POST /api/orders/:id/verify-payment   { razorpay_order_id, razorpay_payment_id, razorpay_signature }
export const verifyPayment = async (req, res) => {
  const {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: signature,
  } = req.body ?? {};

  if (!isRazorpayConfigured()) throw new AppError('Online payments are not configured', 503);

  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw new AppError('Order not found', 404);

  if (order.razorpay?.orderId !== razorpayOrderId || !verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature })) {
    throw new AppError('Payment verification failed', 400);
  }

  // Same logic as the Razorpay webhook (services/payments.js), so whichever arrives
  // first confirms the order and the other is a harmless no-op.
  const { result, order: updated } = await recordRazorpayPayment({ razorpayOrderId, paymentId: razorpayPaymentId });

  // 'already_paid': confirmed by an earlier call or by the webhook: nothing to do
  if (result === 'paid' || result === 'already_paid') return res.json({ success: true, order: updated });

  if (result === 'refund_due') {
    throw new AppError('This order expired before the payment was confirmed. Your payment will be refunded.', 409);
  }

  throw new AppError('This order cannot be paid', 409);
};

// POST /api/orders/:id/cancel   (unpaid orders only; paid orders need a refund)
export const cancelOrder = async (req, res) => {
  const cancelled = await Order.cancelUnpaid({ _id: req.params.id, user: req.user._id }, 'Cancelled by customer');
  if (cancelled) return res.json({ success: true, order: cancelled });

  const exists = await Order.exists({ _id: req.params.id, user: req.user._id });
  if (!exists) throw new AppError('Order not found', 404);
  throw new AppError('This order can no longer be cancelled', 409);
};

// GET /api/orders/mine?page=1&limit=10
export const getMyOrders = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const filter = { user: req.user._id };

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({ success: true, orders, page, pages: Math.ceil(total / limit), total });
};

// GET /api/orders/:id   (the owner or an admin)
export const getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);
  const allowed = order && (order.user.equals(req.user._id) || req.user.role === 'admin');
  // 404 rather than 403, so other people's order ids can't be discovered
  if (!allowed) throw new AppError('Order not found', 404);

  res.json({ success: true, order });
};
