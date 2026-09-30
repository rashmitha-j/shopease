import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useApi } from '../hooks/useApi.js';
import { discountPercent, formatPrice } from '../utils/format.js';
import { FREE_SHIPPING_THRESHOLD } from '../utils/orders.js';
import StarRating from '../components/products/StarRating.jsx';
import AddToCart from '../components/cart/AddToCart.jsx';
import ProductReviews from '../components/reviews/ProductReviews.jsx';
import { EmptyState, ErrorState } from '../components/ui/StatusMessage.jsx';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { data, error, retry } = useApi(`/products/${encodeURIComponent(slug)}`);

  if (error?.status === 404) {
    return (
      <>
        <title>Product not found | ShopEase</title>
        <EmptyState title="Product not found" message="It may have been removed, or the link is incorrect.">
          <Link to="/products" className="btn-primary">
            Browse products
          </Link>
        </EmptyState>
      </>
    );
  }
  if (error) return <ErrorState message={error.message} onRetry={retry} />;

  // Also show the skeleton while moving from one product to another,
  // instead of briefly showing the previous product
  const product = data?.product;
  if (!product || product.slug !== slug.toLowerCase()) return <DetailSkeleton />;

  const { name, brand, category, description, price, mrp, images, stock, rating, numReviews } = product;
  const discount = discountPercent(price, mrp);

  return (
    <>
      <title>{`${name} | ShopEase`}</title>

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link to="/products" className="hover:text-brand-700">
              Products
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to={`/products?${new URLSearchParams({ category })}`} className="hover:text-brand-700">
              {category}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="truncate font-medium text-slate-900" aria-current="page">
            {name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        {/* key resets the selected image when switching products */}
        <Gallery key={product._id} images={images} name={name} />

        <div className="md:py-2">
          <p className="text-sm font-semibold tracking-wider text-brand-600 uppercase">{brand}</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{name}</h1>

          <div className="mt-2">
            {numReviews > 0 ? (
              <StarRating rating={rating} numReviews={numReviews} />
            ) : (
              <p className="text-sm text-slate-500">No reviews yet</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-4xl font-extrabold">{formatPrice(price)}</span>
            {discount > 0 && (
              <>
                <span className="text-lg text-slate-500 line-through">
                  <span className="sr-only">MRP </span>
                  {formatPrice(mrp)}
                </span>
                <span className="rounded-full bg-linear-to-r from-pink-600 to-rose-600 px-2.5 py-0.5 text-sm font-bold text-white">
                  {discount}% off
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">Inclusive of all taxes</p>

          <StockStatus stock={stock} />

          {/* key resets the chosen quantity and message when switching products */}
          <AddToCart key={product._id} product={product} />

          <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <li className="rounded-xl bg-indigo-50 px-3 py-2.5 font-medium text-indigo-800">
              Free shipping over {formatPrice(FREE_SHIPPING_THRESHOLD)}
            </li>
            <li className="rounded-xl bg-pink-50 px-3 py-2.5 font-medium text-pink-800">Secure Razorpay checkout</li>
            <li className="rounded-xl bg-amber-50 px-3 py-2.5 font-medium text-amber-900">Cash on delivery available</li>
          </ul>

          <div className="card mt-6 p-5">
            <h2 className="text-sm font-semibold text-slate-900">Description</h2>
            <p className="mt-2 leading-relaxed whitespace-pre-line text-slate-700">{description}</p>
          </div>
        </div>
      </div>

      {/* key resets sort/page when switching products; onChanged refreshes the rating shown above */}
      <ProductReviews key={product._id} slug={product.slug} onChanged={retry} />
    </>
  );
}

function Gallery({ images, name }) {
  const [selected, setSelected] = useState(0);
  const current = images[selected] ?? images[0];

  return (
    <div>
      <div className="relative isolate">
        <div
          aria-hidden="true"
          className="absolute -inset-3 -z-10 rounded-[2rem] bg-linear-to-br from-indigo-200 via-purple-200 to-pink-200 opacity-70 blur-xl"
        />
        <div className="aspect-square overflow-hidden rounded-3xl border border-white bg-slate-100 shadow-xl shadow-indigo-900/10">
          {current && (
            <img src={current.url} alt={name} width="800" height="800" className="size-full object-cover" />
          )}
        </div>
      </div>
      {images.length > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-2">
          {images.map((image, i) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-pressed={i === selected}
                className={`aspect-square w-full overflow-hidden rounded-xl border-2 ${
                  i === selected ? 'border-brand-600' : 'border-transparent hover:border-slate-300'
                }`}
              >
                <img src={image.url} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StockStatus({ stock }) {
  const [label, style] =
    stock === 0
      ? ['Out of stock', 'bg-red-50 text-red-700 ring-red-200']
      : stock <= 5
        ? [`Only ${stock} left in stock`, 'bg-amber-50 text-amber-800 ring-amber-200']
        : ['In stock', 'bg-emerald-50 text-emerald-700 ring-emerald-200'];
  return (
    <p className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${style}`}>
      <span className="size-2 rounded-full bg-current" aria-hidden="true" />
      {label}
    </p>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2 lg:gap-12" aria-busy="true" aria-label="Loading product">
      <div className="aspect-square animate-pulse rounded-3xl bg-slate-200" />
      <div className="space-y-4">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-24 w-full animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}
