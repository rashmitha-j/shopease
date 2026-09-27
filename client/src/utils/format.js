const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

// 12999 -> "₹12,999"
export const formatPrice = (amount) => inr.format(amount);

// price 7999, mrp 12999 -> 38 (percent off); 0 when there is no discount
export const discountPercent = (price, mrp) => (mrp > price ? Math.round((1 - price / mrp) * 100) : 0);
