import { Link } from 'react-router';
import { useApi } from '../hooks/useApi.js';
import ProductGrid, { ProductGridSkeleton } from '../components/products/ProductGrid.jsx';
import { ErrorState } from '../components/ui/StatusMessage.jsx';

const FEATURED_COUNT = 8;

const CATEGORY_STYLES = {
  Electronics: { icon: '🎧', color: 'bg-sky-50 text-sky-700 hover:bg-sky-100' },
  Fashion: { icon: '👟', color: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
  Home: { icon: '🛋️', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  Books: { icon: '📚', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  Sports: { icon: '🏸', color: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
  Beauty: { icon: '✨', color: 'bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100' },
};

export default function HomePage() {
  return (
    <>
      <title>ShopEase | Shop electronics, fashion, home and more</title>

      <section className="rounded-2xl bg-linear-to-br from-brand-600 to-brand-700 px-6 py-16 text-center text-white sm:px-12 sm:py-24">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Everything you need, in one place</h1>
        <p className="mx-auto mt-4 max-w-xl text-brand-100 sm:text-lg">
          Electronics, fashion, home, books, sports and beauty at great prices.
        </p>
        <Link
          to="/products"
          className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
        >
          Shop now
        </Link>
      </section>

      <CategoryTiles />
      <FeaturedProducts />
    </>
  );
}

function CategoryTiles() {
  const { data, error } = useApi('/products/categories');
  if (error) return null; // the featured section below shows the error and a retry button

  return (
    <section aria-labelledby="categories-heading" className="mt-12">
      <h2 id="categories-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
        Shop by category
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {!data
          ? Array.from({ length: 6 }, (_, i) => <li key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />)
          : data.categories.map(({ name, count }) => {
              const style = CATEGORY_STYLES[name] ?? { icon: '🛍️', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200' };
              return (
                <li key={name}>
                  <Link
                    to={`/products?${new URLSearchParams({ category: name })}`}
                    className={`flex h-24 flex-col items-center justify-center rounded-xl text-center transition ${style.color}`}
                  >
                    <span className="text-2xl" aria-hidden="true">
                      {style.icon}
                    </span>
                    <span className="mt-1 font-semibold">{name}</span>
                    <span className="text-xs opacity-75">
                      {count} {count === 1 ? 'item' : 'items'}
                    </span>
                  </Link>
                </li>
              );
            })}
      </ul>
    </section>
  );
}

function FeaturedProducts() {
  // The API has no "featured" filter, so fetch up to its maximum page size (100)
  // and pick the featured products here.
  const { data, error, retry } = useApi('/products?limit=100');
  const featured = data?.products.filter((p) => p.isFeatured).slice(0, FEATURED_COUNT);

  if (featured?.length === 0) return null;

  return (
    <section aria-labelledby="featured-heading" className="mt-12">
      <div className="flex items-end justify-between gap-4">
        <h2 id="featured-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
          Featured products
        </h2>
        <Link to="/products" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          View all →
        </Link>
      </div>
      <div className="mt-4">
        {error ? (
          <ErrorState message={error.message} onRetry={retry} />
        ) : !featured ? (
          <ProductGridSkeleton count={4} />
        ) : (
          <ProductGrid products={featured} />
        )}
      </div>
    </section>
  );
}
