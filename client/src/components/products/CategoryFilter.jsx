import { Link } from 'react-router';
import { useApi } from '../../hooks/useApi.js';

// Horizontal scrolling chips on small screens, a vertical list in the sidebar on large screens.
// `getSearch(category)` returns the query string for a link, so filters stay shareable URLs.
export default function CategoryFilter({ selected, getSearch }) {
  const { data, error } = useApi('/products/categories');
  const current = selected.toLowerCase();

  if (error) return <p className="text-sm text-red-700">Couldn’t load categories.</p>;

  const items = [{ name: 'All', value: '' }, ...(data?.categories ?? []).map((c) => ({ ...c, value: c.name }))];

  return (
    <nav aria-label="Categories">
      <h2 className="mb-2 hidden text-sm font-semibold text-gray-900 lg:block">Categories</h2>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:flex-col lg:gap-0.5 lg:overflow-visible">
        {!data
          ? Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-gray-200 lg:w-full lg:rounded-lg" />
            ))
          : items.map((item) => {
              const active = item.value.toLowerCase() === current;
              return (
                <li key={item.name} className="shrink-0">
                  <Link
                    to={{ search: getSearch(item.value) }}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center justify-between gap-3 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition lg:rounded-lg lg:border-transparent lg:px-3 ${
                      active
                        ? 'border-brand-600 bg-brand-600 text-white lg:bg-brand-50 lg:text-brand-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 lg:bg-transparent lg:hover:bg-gray-100'
                    }`}
                  >
                    {item.name}
                    {item.count !== undefined && (
                      <span className={`text-xs ${active ? 'text-brand-100 lg:text-brand-600' : 'text-gray-400'}`}>
                        {item.count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
      </ul>
    </nav>
  );
}
