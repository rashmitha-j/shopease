import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useCart } from '../../hooks/useCart.js';
import { maxQuantityFor } from '../../utils/cart.js';
import { discountPercent, formatPrice } from '../../utils/format.js';
import Stars from '../reviews/Stars.jsx';

export default function ProductCard({ product }) {
  const { slug, name, brand, price, mrp, images, stock, rating, numReviews } = product;
  const discount = discountPercent(price, mrp);
  const outOfStock = stock === 0;
  const href = `/products/${slug}`;

  return (
    // The product name's link is stretched over the whole card (before:absolute),
    // so the card is clickable while the Add to cart button stays a separate control.
    <article className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-900/10 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand-500">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {images?.[0]?.url && (
          <img
            src={images[0].url}
            alt=""
            loading="lazy"
            width="800"
            height="800"
            className={`size-full object-cover transition duration-500 ease-out group-hover:scale-110 ${outOfStock ? 'opacity-60 grayscale' : ''}`}
          />
        )}
        {outOfStock ? (
          <span className="absolute top-3 left-3 rounded-full bg-slate-900/85 px-2.5 py-1 text-xs font-semibold text-white">
            Out of stock
          </span>
        ) : (
          discount > 0 && (
            <span className="absolute top-3 left-3 rounded-full bg-linear-to-r from-pink-600 to-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-md">
              {discount}% off
            </span>
          )
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold tracking-wider text-brand-600 uppercase">{brand}</p>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 sm:text-base">
          <Link to={href} className="before:absolute before:inset-0 before:z-0 focus-visible:outline-none">
            {name}
          </Link>
        </h3>
        <div className="mt-1.5 flex min-h-5 items-center gap-1.5 text-xs text-slate-500">
          {numReviews > 0 ? (
            <>
              <Stars rating={Number(rating.toFixed(1))} size="text-sm" />
              <span>({numReviews})</span>
            </>
          ) : (
            'No reviews yet'
          )}
        </div>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-3">
          <span className="text-lg font-bold text-slate-900">{formatPrice(price)}</span>
          {discount > 0 && (
            <span className="text-sm text-slate-500 line-through">
              <span className="sr-only">MRP </span>
              {formatPrice(mrp)}
            </span>
          )}
        </div>
        <CardAddToCart product={product} />
      </div>
    </article>
  );
}

// Adds one of the product with the same cart action as the product page,
// respecting stock and the per-item limit
function CardAddToCart({ product }) {
  const { items, addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(false), 1800);
    return () => clearTimeout(timer);
  }, [justAdded]);

  const inCart = items.find((i) => i.productId === product._id)?.quantity ?? 0;
  const canAdd = inCart < maxQuantityFor(product.stock);
  const label = product.stock === 0 ? 'Out of stock' : justAdded ? 'Added ✓' : canAdd ? 'Add to cart' : 'Max in cart';

  return (
    <>
      <button
        type="button"
        disabled={!canAdd}
        onClick={() => {
          addItem(product, 1);
          setJustAdded(true);
        }}
        className={`relative z-10 mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed ${
          justAdded
            ? 'bg-emerald-700 text-white'
            : 'bg-linear-to-r from-brand-600 to-purple-600 text-white shadow-md shadow-brand-600/20 hover:shadow-lg hover:shadow-purple-600/30 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-600 disabled:shadow-none'
        }`}
      >
        {label}
        <span className="sr-only">: {product.name}</span>
      </button>
      <p role="status" className="sr-only">
        {justAdded ? `Added ${product.name} to your cart` : ''}
      </p>
    </>
  );
}
