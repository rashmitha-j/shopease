import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useApi } from '../hooks/useApi.js';
import { discountPercent, formatPrice } from '../utils/format.js';
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
          <Link
            to="/products"
            className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
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

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link to="/products" className="hover:text-gray-900">
              Products
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to={`/products?${new URLSearchParams({ category })}`} className="hover:text-gray-900">
              {category}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="truncate text-gray-900" aria-current="page">
            {name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        {/* key resets the selected image when switching products */}
        <Gallery key={product._id} images={images} name={name} />

        <div>
          <p className="text-sm font-medium tracking-wide text-gray-500 uppercase">{brand}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{name}</h1>

          <div className="mt-2">
            {numReviews > 0 ? (
              <StarRating rating={rating} numReviews={numReviews} />
            ) : (
              <p className="text-sm text-gray-500">No reviews yet</p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-bold">{formatPrice(price)}</span>
            {discount > 0 && (
              <>
                <span className="text-lg text-gray-400 line-through">{formatPrice(mrp)}</span>
                <span className="rounded-md bg-green-100 px-2 py-0.5 text-sm font-semibold text-green-700">
                  {discount}% off
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">Inclusive of all taxes</p>

          <StockStatus stock={stock} />

          {/* key resets the chosen quantity and message when switching products */}
          <AddToCart key={product._id} product={product} />

          <div className="mt-8 border-t border-gray-200 pt-6">
            <h2 className="text-sm font-semibold text-gray-900">Description</h2>
            <p className="mt-2 leading-relaxed whitespace-pre-line text-gray-700">{description}</p>
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
      <div className="aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
        {current && (
          <img src={current.url} alt={name} width="600" height="600" className="size-full object-cover" />
        )}
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
                className={`aspect-square w-full overflow-hidden rounded-lg border-2 ${
                  i === selected ? 'border-brand-600' : 'border-transparent hover:border-gray-300'
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
  if (stock === 0) return <p className="mt-4 text-sm font-semibold text-red-700">Out of stock</p>;
  if (stock <= 5) return <p className="mt-4 text-sm font-semibold text-amber-700">Only {stock} left in stock</p>;
  return <p className="mt-4 text-sm font-semibold text-green-700">In stock</p>;
}

function DetailSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2 lg:gap-12" aria-busy="true" aria-label="Loading product">
      <div className="aspect-square animate-pulse rounded-2xl bg-gray-200" />
      <div className="space-y-4">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-3/4 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-24 w-full animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}
