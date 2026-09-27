import mongoose from 'mongoose';
import Product from './Product.js';

export const ORDER_STATUSES = ['awaiting_payment', 'confirmed', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_METHODS = ['razorpay', 'cod'];

// Unpaid orders that the customer can still cancel (and that release their stock)
const CANCELLABLE = ['awaiting_payment', 'confirmed'];

// A copy of the product at the time of purchase, so later price changes or
// deleted products don't change past orders
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    image: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const requiredText = (label, max) => ({
  type: String,
  required: [true, `${label} is required`],
  trim: true,
  maxlength: [max, `${label} cannot exceed ${max} characters`],
});

// Same fields as the address on the User model
const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: requiredText('Full name', 60),
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      // "+91 98765-43210" -> "9876543210"
      set: (v) => String(v).replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, ''),
      match: [/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'],
    },
    line1: requiredText('Address line 1', 120),
    line2: { type: String, trim: true, maxlength: [120, 'Address line 2 cannot exceed 120 characters'] },
    city: requiredText('City', 60),
    state: requiredText('State', 60),
    postalCode: {
      type: String,
      required: [true, 'PIN code is required'],
      trim: true,
      match: [/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code'],
    },
    country: { type: String, default: 'India', enum: { values: ['India'], message: 'We only ship within India' } },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [orderItemSchema],
      validate: { validator: (items) => items.length > 0, message: 'An order needs at least one item' },
    },
    shippingAddress: { type: shippingAddressSchema, required: [true, 'Shipping address is required'] },
    itemsTotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: { values: PAYMENT_METHODS, message: 'Payment method must be razorpay or cod' },
    },
    paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    status: { type: String, enum: ORDER_STATUSES, required: true },
    razorpay: {
      orderId: { type: String },
      paymentId: { type: String },
    },
    paidAt: Date,
    cancelledAt: Date,
    cancelReason: String,
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ 'razorpay.orderId': 1 }, { unique: true, sparse: true });
orderSchema.index({ status: 1, createdAt: 1 }); // finding expired unpaid orders

// Cancels an unpaid order and puts its stock back, all in one transaction.
// The status check in the filter makes this safe to call twice (or at the same
// time as a payment being confirmed): only one caller can win.
// Returns the cancelled order, or null if it could not be cancelled.
orderSchema.statics.cancelUnpaid = async function (filter, reason) {
  const session = await mongoose.startSession();
  try {
    let cancelled = null;
    await session.withTransaction(async () => {
      cancelled = await this.findOneAndUpdate(
        { ...filter, status: { $in: CANCELLABLE }, paymentStatus: { $ne: 'paid' } },
        { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason } },
        { new: true, session }
      );
      if (!cancelled) return;
      await Product.bulkWrite(
        cancelled.items.map((item) => ({
          updateOne: { filter: { _id: item.product }, update: { $inc: { stock: item.quantity } } },
        })),
        { session }
      );
    });
    return cancelled;
  } finally {
    await session.endSession();
  }
};

orderSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const Order = mongoose.model('Order', orderSchema);
export default Order;
