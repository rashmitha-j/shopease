// Money rules for orders. All amounts are in rupees; Razorpay needs paise.

export const FREE_SHIPPING_THRESHOLD = 999;
export const SHIPPING_FEE = 49;
export const MAX_QUANTITY_PER_ITEM = 10;
export const MAX_ITEMS_PER_ORDER = 20; // distinct products

// Avoids floating-point drift like 0.1 + 0.2 = 0.30000000000000004
export const roundMoney = (amount) => Math.round(amount * 100) / 100;

export const shippingFeeFor = (itemsTotal) => (itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE);

// ₹499.50 -> 49950 paise (Razorpay only accepts whole paise)
export const toPaise = (rupees) => Math.round(rupees * 100);

export function calculateTotals(items) {
  const itemsTotal = roundMoney(items.reduce((sum, i) => sum + i.price * i.quantity, 0));
  const shippingFee = shippingFeeFor(itemsTotal);
  return { itemsTotal, shippingFee, totalAmount: roundMoney(itemsTotal + shippingFee) };
}
