import { api } from './client.js';

// { items: [{ productId, quantity }], shippingAddress, paymentMethod: 'razorpay' | 'cod' }
// Resolves with { order } or, for Razorpay, { order, razorpay: { keyId, orderId, amount, currency } }
export const placeOrder = (body) => api('/orders', { method: 'POST', body });

// `payment` is what Razorpay Checkout passes to its success handler
export const verifyPayment = (orderId, payment) =>
  api(`/orders/${orderId}/verify-payment`, {
    method: 'POST',
    body: {
      razorpay_order_id: payment.razorpay_order_id,
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_signature: payment.razorpay_signature,
    },
  });

export const cancelOrder = (orderId) => api(`/orders/${orderId}/cancel`, { method: 'POST' });
