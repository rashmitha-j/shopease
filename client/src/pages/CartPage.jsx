import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';
import { useCart } from '../hooks/useCart.js';
import { applyLatestProducts } from '../utils/cart.js';
import { formatPrice } from '../utils/format.js';
import CartLine from '../components/cart/CartLine.jsx';
import { EmptyState } from '../components/ui/StatusMessage.jsx';

// The cart stores a copy of each product. When the cart page opens, fetch every
// product again so prices and stock are current, and tell the user what changed.
function useRefreshCartProducts() {
  const { items, syncWithLatest } = useCart();
  const [initialItems] = useState(items); // check the items that were in the cart when the page opened
  const [result, setResult] = useState({ done: initialItems.length === 0, notices: [], failed: false });

  useEffect(() => {
    if (initialItems.length === 0) return;
    const controller = new AbortController();

    Promise.all(
      initialItems.map((item) =>
        api(`/products/${encodeURIComponent(item.slug)}`, { signal: controller.signal }).then(
          (data) => data.product,
          (err) => (err.status === 404 ? null : undefined), // null = deleted, undefined = couldn't check
        ),
      ),
    ).then((products) => {
      if (controller.signal.aborted) return;
      const latest = Object.fromEntries(initialItems.map((item, i) => [item.productId, products[i]]));
      syncWithLatest(latest);
      setResult({
        done: true,
        notices: applyLatestProducts(initialItems, latest).notices,
        failed: products.some((p) => p === undefined),
      });
    });

    return () => controller.abort();
  }, [initialItems, syncWithLatest]);

  return result;
}

export default function CartPage() {
  const { items, totals, clearCart } = useCart();
  const { user } = useAuth();
  const { done, notices, failed } = useRefreshCartProducts();
  const hasOutOfStock = items.some((i) => i.stock < 1);

  if (items.length === 0) {
    return (
      <>
        <title>Your cart | ShopEase</title>
        <h1 className="mb-6 text-3xl font-extrabold sm:text-4xl">Your cart</h1>
        {notices.length > 0 && <Notices notices={notices} />}
        <EmptyState title="Your cart is empty" message="Find something you like and add it to your cart.">
          <Link
            to="/products"
            className="btn-primary"
          >
            Browse products
          </Link>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <title>{`Your cart (${totals.count}) | ShopEase`}</title>
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Your cart</h1>
        <button type="button" onClick={clearCart} className="text-sm font-medium text-slate-500 hover:text-red-700">
          Clear cart
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {!done && (
          <p className="text-sm text-slate-500" role="status">
            Checking latest prices and stock…
          </p>
        )}
        {notices.length > 0 && <Notices notices={notices} />}
        {failed && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
            Couldn’t check the latest prices for some items. The prices shown may be out of date.
          </p>
        )}
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-8">
        <section aria-label="Cart items" className="card px-4 sm:px-6">
          <ul className="divide-y divide-slate-200">
            {items.map((item) => (
              <CartLine key={item.productId} item={item} />
            ))}
          </ul>
        </section>

        <aside
          aria-labelledby="summary-heading"
          className="mt-6 card p-6 lg:sticky lg:top-24 lg:mt-0"
        >
          <h2 id="summary-heading" className="text-lg font-semibold">
            Order summary
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">
                Items ({totals.count})
              </dt>
              <dd>{formatPrice(totals.subtotal + totals.savings)}</dd>
            </div>
            {totals.savings > 0 && (
              <div className="flex justify-between text-green-700">
                <dt>Discount</dt>
                <dd>−{formatPrice(totals.savings)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-semibold">
              <dt>Subtotal</dt>
              <dd>{formatPrice(totals.subtotal)}</dd>
            </div>
          </dl>
          <p className="mt-1 text-xs text-slate-500">Shipping is calculated at checkout.</p>

          {hasOutOfStock ? (
            <>
              <button
                type="button"
                disabled
                className="btn-primary mt-6 w-full py-3 text-base"
              >
                Proceed to checkout
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">Remove out-of-stock items before checking out.</p>
            </>
          ) : (
            <Link
              to="/checkout"
              className="btn-primary mt-6 w-full py-3 text-base"
            >
              Proceed to checkout
            </Link>
          )}
          {!user && (
            <p className="mt-3 text-center text-xs text-slate-500">You’ll be asked to log in before paying.</p>
          )}
        </aside>
      </div>
    </>
  );
}

function Notices({ notices }) {
  return (
    <ul role="status" className="space-y-1 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
      {notices.map((notice) => (
        <li key={notice}>{notice}</li>
      ))}
    </ul>
  );
}
