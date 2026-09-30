import ProductCard from './ProductCard.jsx';

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4';

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
        <li key={i} className="card overflow-hidden">
          <div className="skeleton aspect-square" />
          <div className="space-y-2 p-4">
            <div className="skeleton h-3 w-1/3 rounded" />
            <div className="skeleton h-4 w-4/5 rounded" />
            <div className="skeleton h-4 w-1/4 rounded" />
            <div className="skeleton mt-3 h-10 w-full rounded-xl" />
          </div>
        </li>
      ))}
    </ul>
  );
}
