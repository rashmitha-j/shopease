import { Link, useNavigate, useSearchParams } from 'react-router';
import { useApi } from '../hooks/useApi.js';
import CategoryFilter from '../components/products/CategoryFilter.jsx';
import ProductGrid, { ProductGridSkeleton } from '../components/products/ProductGrid.jsx';
import Pagination from '../components/products/Pagination.jsx';
import { EmptyState, ErrorState } from '../components/ui/StatusMessage.jsx';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

export default function ProductsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // The URL is the single source of truth for search, filter, sort and page
  const q = searchParams.get('q')?.trim() ?? '';
  const category = searchParams.get('category') ?? '';
  const sortParam = searchParams.get('sort');
  const sort = SORT_OPTIONS.some((o) => o.value === sortParam) ? sortParam : 'newest';
  const page = Math.max(Number.parseInt(searchParams.get('page'), 10) || 1, 1);

  const apiParams = new URLSearchParams({ page, limit: PAGE_SIZE, sort });
  if (q) apiParams.set('q', q);
  if (category) apiParams.set('category', category);
  const { data, error, loading, retry } = useApi(`/products?${apiParams}`);

  // Builds the query string for a link. Changing a filter goes back to page 1.
  const searchWith = (changes) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value && !(key === 'page' && value === 1) && !(key === 'sort' && value === 'newest')) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    if (!('page' in changes)) next.delete('page');
    const str = next.toString();
    return str ? `?${str}` : '';
  };

  const heading = q ? `Results for “${q}”` : category || 'All products';
  const hasFilters = Boolean(q || category);

  return (
    <>
      <title>{`${heading} | ShopEase`}</title>

      <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-8">
        <aside className="mb-6 lg:mb-0">
          <CategoryFilter selected={category} getSearch={(value) => searchWith({ category: value })} />
        </aside>

        <section aria-labelledby="products-heading" className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 id="products-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
                {heading}
              </h1>
              <p className="mt-1 text-sm text-gray-600" aria-live="polite">
                {data ? `${data.total} ${data.total === 1 ? 'product' : 'products'}` : ' '}
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              Sort by
              <select
                value={sort}
                onChange={(e) => navigate({ search: searchWith({ sort: e.target.value }) })}
                className="rounded-lg border border-gray-300 bg-white py-2 pr-8 pl-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {hasFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              {q && <FilterChip label={`“${q}”`} to={searchWith({ q: '' })} />}
              {category && <FilterChip label={category} to={searchWith({ category: '' })} />}
              <Link to="/products" className="font-medium text-brand-600 hover:text-brand-700">
                Clear all
              </Link>
            </div>
          )}

          <div className="mt-6">
            {error ? (
              <ErrorState message={error.message} onRetry={retry} />
            ) : !data ? (
              <ProductGridSkeleton count={PAGE_SIZE} />
            ) : data.products.length === 0 ? (
              <EmptyState
                title="No products found"
                message={
                  page > 1 && data.total > 0
                    ? `This page is empty. There are only ${data.pages} pages.`
                    : 'Try a different search or category.'
                }
              >
                <Link
                  to={page > 1 && data.total > 0 ? { search: searchWith({ page: 1 }) } : '/products'}
                  className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  {page > 1 && data.total > 0 ? 'Go to page 1' : 'View all products'}
                </Link>
              </EmptyState>
            ) : (
              <>
                <ProductGrid
                  products={data.products}
                  // Dim the old results while the next page/filter loads
                  className={`transition-opacity ${loading ? 'opacity-50' : ''}`}
                />
                <div className="mt-8">
                  <Pagination page={data.page} pages={data.pages} getSearch={(n) => searchWith({ page: n })} />
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function FilterChip({ label, to }) {
  return (
    <Link
      to={{ search: to }}
      className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700 hover:bg-brand-100"
      aria-label={`Remove filter ${label}`}
    >
      {label}
      <span aria-hidden="true">×</span>
    </Link>
  );
}
