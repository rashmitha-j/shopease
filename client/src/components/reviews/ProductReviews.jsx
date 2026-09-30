import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { formatDateTime } from '../../utils/orders.js';
import { ErrorState } from '../ui/StatusMessage.jsx';
import MyReviewPanel from './MyReviewPanel.jsx';
import Stars from './Stars.jsx';

const PAGE_SIZE = 5;
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' },
];

// Reviews section of the product page. `onChanged` lets the page refresh the product's
// rating after the customer writes, edits or deletes a review.
export default function ProductReviews({ slug, onChanged }) {
  const { user, status } = useAuth();
  const location = useLocation();
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const { data, error, loading, retry } = useApi(
    `/products/${encodeURIComponent(slug)}/reviews?${new URLSearchParams({ sort, page, limit: PAGE_SIZE })}`
  );

  const refresh = () => {
    retry();
    onChanged();
  };

  return (
    <section aria-labelledby="reviews-heading" className="mt-12 border-t border-slate-200 pt-10">
      <h2 id="reviews-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
        Customer reviews
      </h2>

      <div className="mt-6 grid gap-8 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-6">
          {data && <Summary summary={data.summary} />}

          <div className="card p-5">
            {status === 'loading' ? null : user ? (
              <MyReviewPanel slug={slug} onChanged={refresh} />
            ) : (
              <p className="text-sm text-slate-600">
                <Link
                  to="/login"
                  state={{ from: location.pathname + location.search }}
                  className="font-semibold text-brand-600 hover:text-brand-700"
                >
                  Log in
                </Link>{' '}
                to write a review. Only customers who have received this product can review it.
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0">
          {error ? (
            <ErrorState message={error.message} onRetry={retry} />
          ) : !data ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading reviews">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : data.total === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">
              No reviews yet.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-600" aria-live="polite">
                  {data.total} {data.total === 1 ? 'review' : 'reviews'}
                </p>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  Sort
                  <select
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setPage(1);
                    }}
                    className="rounded-xl border border-slate-300 bg-white py-1.5 pr-8 pl-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                  >
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <ul className={`mt-4 divide-y divide-slate-200 transition-opacity ${loading ? 'opacity-50' : ''}`}>
                {data.reviews.map((review) => (
                  <li key={review._id} className="py-5 first:pt-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars rating={review.rating} />
                      <span className="text-sm font-medium text-slate-900">{review.user?.name ?? 'Former customer'}</span>
                      <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">Verified purchase</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-800">{review.comment}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDateTime(review.createdAt)}</p>
                  </li>
                ))}
              </ul>

              {data.pages > 1 && (
                <nav aria-label="Review pages" className="mt-4 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page <= 1}
                    className="rounded-xl px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    ← Previous
                  </button>
                  <span className="text-slate-600">
                    Page {data.page} of {data.pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= data.pages}
                    className="rounded-xl px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    Next →
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Summary({ summary }) {
  const { average, count, distribution } = summary;
  return (
    <div className="card p-5">
      {count === 0 ? (
        <p className="text-sm text-slate-600">Be the first to share your thoughts.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold tabular-nums">{average.toFixed(1)}</span>
            <div>
              <Stars rating={average} />
              <p className="text-sm text-slate-600">
                {count} {count === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-1.5" aria-label="Rating breakdown">
            {[5, 4, 3, 2, 1].map((stars) => {
              const n = distribution[stars] ?? 0;
              const pct = count ? Math.round((n / count) * 100) : 0;
              return (
                <li key={stars} className="flex items-center gap-2 text-sm">
                  <span className="w-12 text-slate-600">{stars} star</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                    <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-8 text-right text-slate-600 tabular-nums">{n}</span>
                  <span className="sr-only">
                    {n} {n === 1 ? 'review' : 'reviews'} with {stars} stars
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
