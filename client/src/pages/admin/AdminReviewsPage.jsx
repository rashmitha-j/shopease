import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApi } from '../../hooks/useApi.js';
import { adminDeleteReview, moderateReview } from '../../api/reviews.js';
import { formatDateTime } from '../../utils/orders.js';
import Stars from '../../components/reviews/Stars.jsx';
import Pagination from '../../components/products/Pagination.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { EmptyState, ErrorState } from '../../components/ui/StatusMessage.jsx';

const PAGE_SIZE = 20;
const FILTERS = ['q', 'status', 'rating'];
const NOTE_MAX = 300;

const selectClass =
  'w-full rounded-lg border border-gray-300 bg-white py-2 pr-8 pl-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none';

const ACTIONS = {
  hide: {
    title: 'Hide this review?',
    confirmLabel: 'Hide review',
    danger: true,
    done: 'Review hidden. The product rating was updated.',
  },
  publish: {
    title: 'Show this review again?',
    confirmLabel: 'Unhide review',
    danger: false,
    done: 'Review is visible again. The product rating was updated.',
  },
  delete: {
    title: 'Delete this review permanently?',
    confirmLabel: 'Delete review',
    danger: true,
    done: 'Review deleted. The product rating was updated.',
  },
};

export default function AdminReviewsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(Number.parseInt(searchParams.get('page'), 10) || 1, 1);
  const filters = Object.fromEntries(FILTERS.map((key) => [key, searchParams.get(key)?.trim() ?? '']));
  const hasFilters = FILTERS.some((key) => filters[key]);

  const apiParams = new URLSearchParams({ page, limit: PAGE_SIZE });
  for (const key of FILTERS) if (filters[key]) apiParams.set(key, filters[key]);
  const { data, error, loading, retry } = useApi(`/admin/reviews?${apiParams}`);

  const [pending, setPending] = useState(null); // { action, review }
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState('');
  const [flash, setFlash] = useState('');

  const updateFilters = (changes) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('page');
    setSearchParams(next);
  };

  const open = (action, review) => {
    setNote('');
    setActionError('');
    setFlash('');
    setPending({ action, review });
  };

  const confirm = async () => {
    const { action, review } = pending;
    setWorking(true);
    setActionError('');
    try {
      if (action === 'delete') await adminDeleteReview(review._id);
      else await moderateReview(review._id, { status: action === 'hide' ? 'hidden' : 'published', note: note.trim() });
      setFlash(ACTIONS[action].done);
      setPending(null);
      retry();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setWorking(false);
    }
  };

  const action = pending && ACTIONS[pending.action];

  return (
    <>
      <title>Admin: Reviews | ShopEase</title>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reviews</h1>

      {flash && (
        <div role="status" className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>{flash}</span>
          <button type="button" onClick={() => setFlash('')} className="font-medium hover:text-green-950" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <form
        role="search"
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          updateFilters({ q: new FormData(e.currentTarget).get('q').trim() });
        }}
      >
        <label htmlFor="admin-review-search" className="sr-only">
          Search reviews
        </label>
        <input
          key={filters.q}
          id="admin-review-search"
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder="Search review text, product or customer"
          maxLength={100}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
        <button type="submit" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Search
        </button>
      </form>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
        <label className="text-sm text-gray-700">
          <span className="mb-1 block text-xs font-medium text-gray-500">Visibility</span>
          <select value={filters.status} onChange={(e) => updateFilters({ status: e.target.value })} className={selectClass}>
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <label className="text-sm text-gray-700">
          <span className="mb-1 block text-xs font-medium text-gray-500">Rating</span>
          <select value={filters.rating} onChange={(e) => updateFilters({ rating: e.target.value })} className={selectClass}>
            <option value="">Any rating</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'star' : 'stars'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5">
        {error ? (
          <ErrorState message={error.message} onRetry={retry} />
        ) : !data ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading reviews">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200" />
            ))}
          </div>
        ) : data.reviews.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No reviews match' : 'No reviews yet'}
            message={hasFilters ? 'Try a different search or filter.' : 'Reviews appear here when customers review products they received.'}
          >
            {hasFilters && (
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear filters
              </button>
            )}
          </EmptyState>
        ) : (
          <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
            <p className="mb-2 text-sm text-gray-600" aria-live="polite">
              {data.total} {data.total === 1 ? 'review' : 'reviews'}
            </p>
            <ul className="space-y-3">
              {data.reviews.map((review) => (
                <li key={review._id}>
                  <ReviewCard review={review} onAction={open} />
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Pagination
                page={data.page}
                pages={data.pages}
                getSearch={(n) => {
                  const next = new URLSearchParams(searchParams);
                  if (n === 1) next.delete('page');
                  else next.set('page', n);
                  return next.toString() ? `?${next}` : '';
                }}
              />
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        title={action?.title}
        confirmLabel={action?.confirmLabel}
        cancelLabel="Keep as is"
        danger={action?.danger}
        busy={working}
        error={actionError}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
        message={
          pending && (
            <>
              <blockquote className="rounded-lg bg-gray-50 px-3 py-2 text-gray-700 italic">
                “{pending.review.comment.length > 160 ? `${pending.review.comment.slice(0, 160)}…` : pending.review.comment}”
              </blockquote>
              {pending.action === 'hide' && (
                <>
                  <p className="mt-3">Shoppers won’t see it and it won’t count towards the rating. The author can still see it.</p>
                  <label htmlFor="moderation-note" className="mt-3 block text-sm font-medium text-gray-900">
                    Reason (optional, shown to the author)
                  </label>
                  <textarea
                    id="moderation-note"
                    rows={2}
                    maxLength={NOTE_MAX}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                  />
                </>
              )}
              {pending.action === 'publish' && <p className="mt-3">Shoppers will see it again and it will count towards the rating.</p>}
              {pending.action === 'delete' && <p className="mt-3">This can’t be undone. Hiding it instead keeps a record.</p>}
            </>
          )
        }
      />
    </>
  );
}

function ReviewCard({ review, onAction }) {
  const hidden = review.status === 'hidden';
  return (
    <article className={`rounded-2xl border bg-white p-4 sm:p-5 ${hidden ? 'border-dashed border-gray-300' : 'border-gray-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {review.product ? (
          <Link to={`/products/${review.product.slug}`} className="flex min-w-0 items-center gap-3 hover:text-brand-700">
            {review.product.images?.[0]?.url && (
              <img src={review.product.images[0].url} alt="" loading="lazy" className="size-10 shrink-0 rounded-md object-cover" />
            )}
            <span className="line-clamp-1 text-sm font-medium text-gray-900">{review.product.name}</span>
          </Link>
        ) : (
          <span className="text-sm text-gray-500">Deleted product</span>
        )}
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${hidden ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}`}
        >
          {hidden ? 'Hidden' : 'Published'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Stars rating={review.rating} />
        <span className="font-medium text-gray-900">{review.user?.name ?? 'Former customer'}</span>
        {review.user?.email && <span className="text-gray-500">{review.user.email}</span>}
        <span className="text-gray-500">· {formatDateTime(review.createdAt)}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-gray-800">{review.comment}</p>
      {hidden && review.moderationNote && <p className="mt-2 text-xs text-gray-500">Reason: {review.moderationNote}</p>}

      <div className="mt-3 flex gap-4 border-t border-gray-100 pt-3 text-sm font-medium">
        {hidden ? (
          <button type="button" onClick={() => onAction('publish', review)} className="text-brand-600 hover:text-brand-700">
            Unhide
          </button>
        ) : (
          <button type="button" onClick={() => onAction('hide', review)} className="text-gray-700 hover:text-gray-900">
            Hide
          </button>
        )}
        <button type="button" onClick={() => onAction('delete', review)} className="text-red-600 hover:text-red-700">
          Delete
        </button>
      </div>
    </article>
  );
}
