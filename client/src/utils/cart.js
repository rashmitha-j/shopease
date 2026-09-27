// Pure cart logic (no React), so it is easy to test.
import { formatPrice } from './format.js';

// A cart item is a snapshot of the product plus a quantity:
// { productId, slug, name, brand, image, price, mrp, stock, quantity }

export const MAX_PER_ITEM = 10;
export const STORAGE_KEY = 'shopease.cart.v1';

export const maxQuantityFor = (stock) => Math.max(0, Math.min(stock, MAX_PER_ITEM));

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

const toSnapshot = (product) => ({
  productId: product._id,
  slug: product.slug,
  name: product.name,
  brand: product.brand,
  image: product.images?.[0]?.url ?? '',
  price: product.price,
  mrp: product.mrp ?? null,
  stock: product.stock,
});

export function cartReducer(items, action) {
  switch (action.type) {
    case 'add': {
      const { product, quantity } = action;
      const max = maxQuantityFor(product.stock);
      if (max < 1 || quantity < 1) return items;
      const existing = items.find((i) => i.productId === product._id);
      if (existing) {
        return items.map((i) =>
          i.productId === product._id ? { ...toSnapshot(product), quantity: Math.min(i.quantity + quantity, max) } : i,
        );
      }
      return [...items, { ...toSnapshot(product), quantity: Math.min(quantity, max) }];
    }
    case 'setQuantity':
      return items.map((i) =>
        i.productId === action.productId
          ? { ...i, quantity: clamp(action.quantity, 1, Math.max(1, maxQuantityFor(i.stock))) }
          : i,
      );
    case 'remove':
      return items.filter((i) => i.productId !== action.productId);
    case 'clear':
      return [];
    case 'replace':
      return action.items;
    case 'sync':
      return applyLatestProducts(items, action.latest).items;
    default:
      throw new Error(`Unknown cart action: ${action.type}`);
  }
}

// Updates cart items with fresh product data from the API.
// `latest` maps productId -> product (found), null (deleted, 404) or undefined (request failed: keep as is).
// Returns the new items plus human-readable notices about anything that changed.
export function applyLatestProducts(items, latest) {
  const notices = [];
  const next = [];

  for (const item of items) {
    const product = latest[item.productId];
    if (product === undefined) {
      next.push(item);
      continue;
    }
    if (product === null) {
      notices.push(`${item.name} is no longer available and was removed from your cart.`);
      continue;
    }

    const updated = { ...toSnapshot(product), quantity: item.quantity };
    const max = maxQuantityFor(product.stock);

    if (product.price !== item.price) {
      notices.push(`The price of ${product.name} changed from ${formatPrice(item.price)} to ${formatPrice(product.price)}.`);
    }
    if (max === 0) {
      if (item.stock > 0) notices.push(`${product.name} is now out of stock.`);
    } else if (item.quantity > max) {
      updated.quantity = max;
      notices.push(`Only ${max} of ${product.name} can be ordered, so the quantity was reduced.`);
    }
    next.push(updated);
  }
  return { items: next, notices };
}

// Totals only count items that are in stock
export function cartTotals(items) {
  let count = 0;
  let subtotal = 0;
  let mrpTotal = 0;
  for (const i of items) {
    if (i.stock < 1) continue;
    count += i.quantity;
    subtotal += i.price * i.quantity;
    mrpTotal += Math.max(i.mrp ?? i.price, i.price) * i.quantity;
  }
  return { count, subtotal, savings: mrpTotal - subtotal };
}

const isValidItem = (i) =>
  i &&
  typeof i.productId === 'string' &&
  typeof i.slug === 'string' &&
  typeof i.name === 'string' &&
  Number.isFinite(i.price) &&
  Number.isFinite(i.stock) &&
  Number.isInteger(i.quantity) &&
  i.quantity >= 1;

// Stored data may be missing, from an older version or edited by hand, so validate it
export function parseStoredCart(raw) {
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isValidItem) : [];
  } catch {
    return [];
  }
}
