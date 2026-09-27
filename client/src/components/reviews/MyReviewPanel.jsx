import { useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { createReview, deleteReview, updateReview } from '../../api/reviews.js';
import { formatDateTime } from '../../utils/orders.js';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import ReviewForm from './ReviewForm.jsx';
import Stars from './Stars.jsx';

// The logged-in customer's side of the reviews section: write, view, edit or delete their review.
// Whether they may review comes from the server (delivered-order rule).
export default function MyReviewPanel({ slug, onChanged }) {
  const { data, error, retry } = useApi(`/products/${encodeURIComponent(slug)}/reviews/me`);
  const [mode, setMode] = useState('view'); // 'view' | 'form'
  const [flash, setFlash] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (error) {
    return (
      <p className="text-sm text-red-700">
        Couldn’t check whether you can review this product.{' '}
        <button type="button" onClick={retry} className="font-semibold underline">
          Try again
        </button>
      </p>
    );
  }
  if (!data) return <div className="h-20 animate-pulse rounded-xl bg-gray-100" aria-busy="true" aria-label="Loading" />;

  const afterChange = (message) => {
    setMode('view');
    setFlash(message);
    retry();
    onChanged();
  };

  const review = data.myReview;
  const flashBox = flash && (
    <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
      {flash}
    </p>
  );

  // Writing a new review
  if (!review) {
    if (!data.canReview) {
      return (
        <>
          {flashBox}
          <p className="text-sm text-gray-600">Only customers who have received this product can review it.</p>
        </>
      );
    }
    return mode === 'form' ? (
      <div>
        <h3 className="mb-4 font-semibold">Write a review</h3>
        <ReviewForm
          submitLabel="Publish review"
          busyLabel="Publishing…"
          onSubmit={async (values) => {
            await createReview(slug, values);
            afterChange('Thanks! Your review is published.');
          }}
          onCancel={() => setMode('view')}
        />
      </div>
    ) : (
      <>
        {flashBox}
        <p className="text-sm text-gray-600">You bought this product. Tell other shoppers what you think.</p>
        <button
          type="button"
          onClick={() => {
            setFlash('');
            setMode('form');
          }}
          className="mt-3 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Write a review
        </button>
      </>
    );
  }

  // Editing an existing review
  if (mode === 'form') {
    return (
      <div>
        <h3 className="mb-4 font-semibold">Edit your review</h3>
        <ReviewForm
          initial={{ rating: review.rating, comment: review.comment }}
          submitLabel="Save changes"
          busyLabel="Saving…"
          onSubmit={async (values) => {
            await updateReview(review._id, values);
            afterChange('Your review was updated.');
          }}
          onCancel={() => setMode('view')}
        />
      </div>
    );
  }

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteReview(review._id);
      setConfirmDelete(false);
      afterChange('Your review was deleted.');
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {flashBox}
      <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">Your review</p>
          {review.status === 'hidden' && (
            <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-700">Hidden by the store</span>
          )}
        </div>
        <Stars rating={review.rating} className="mt-2" />
        <p className="mt-2 text-sm whitespace-pre-line text-gray-800">{review.comment}</p>
        <p className="mt-2 text-xs text-gray-500">
          {review.updatedAt !== review.createdAt ? `Edited ${formatDateTime(review.updatedAt)}` : formatDateTime(review.createdAt)}
        </p>
        {review.status === 'hidden' && (
          <p className="mt-3 text-sm text-gray-600">
            Other shoppers can’t see this review{review.moderationNote ? ` (reason: ${review.moderationNote})` : ''}. It doesn’t count
            towards the product rating.
          </p>
        )}
        <div className="mt-3 flex gap-4 text-sm font-medium">
          <button
            type="button"
            onClick={() => {
              setFlash('');
              setMode('form');
            }}
            className="text-brand-600 hover:text-brand-700"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteError('');
              setConfirmDelete(true);
            }}
            className="text-red-600 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete your review?"
        message="Your review and rating will be removed from this product. You can write a new one later."
        confirmLabel="Delete review"
        cancelLabel="Keep review"
        busy={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
