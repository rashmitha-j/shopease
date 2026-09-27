import { Link } from 'react-router';
import { discountPercent, formatPrice } from '../../utils/format.js';
import StarRating from './StarRating.jsx';

export default function ProductCard({ product }) {
  const { slug, name, brand, price, mrp, images, stock, rating, numReviews } = product;
  const discount = discountPercent(price, mrp);
  const outOfStock = stock === 0;

  return (
    <Link
      to={`/products/${slug}`}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        {images?.[0]?.url && (
          <img
            src={images[0].url}
            alt={name}
            loading="lazy"
            width="600"
            height="600"
            className={`size-full object-cover transition duration-300 group-hover:scale-105 ${outOfStock ? 'opacity-60' : ''}`}
          />
        )}
        {outOfStock ? (
          <span className="absolute top-2 left-2 rounded-md bg-gray-900/80 px-2 py-0.5 text-xs font-semibold text-white">
            Out of stock
          </span>
        ) : (
          discount > 0 && (
            <span className="absolute top-2 left-2 rounded-md bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">
              {discount}% off
            </span>
          )
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">{brand}</p>
        <h3 className="mt-1 line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-brand-700 sm:text-base">
          {name}
        </h3>
        {numReviews > 0 && <StarRating rating={rating} numReviews={numReviews} className="mt-1" />}
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
          <span className="font-semibold text-gray-900">{formatPrice(price)}</span>
          {discount > 0 && <span className="text-sm text-gray-400 line-through">{formatPrice(mrp)}</span>}
        </div>
      </div>
    </Link>
  );
}
