import ProductCard from './ProductCard.jsx';

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4';

export default function ProductGrid({ products, className = '' }) {
  return (
    <ul className={`${GRID} ${className}`}>
      {products.map((product) => (
        <li key={product._id} className="flex">
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <ul className={GRID} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="aspect-square animate-pulse bg-gray-200" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-1/4 animate-pulse rounded bg-gray-200" />
          </div>
        </li>
      ))}
    </ul>
  );
}
