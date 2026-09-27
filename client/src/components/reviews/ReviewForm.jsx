import { useState } from 'react';
import StarInput from './StarInput.jsx';
import { TextAreaField } from '../ui/TextField.jsx';
import { REVIEW_MAX_LENGTH, validateReview } from '../../utils/validation.js';

// Used for writing a new review and editing your own. `onSubmit({ rating, comment })` may throw an ApiError.
export default function ReviewForm({ initial = { rating: 0, comment: '' }, submitLabel, busyLabel, onSubmit, onCancel }) {
  const [rating, setRating] = useState(initial.rating);
  const [comment, setComment] = useState(initial.comment);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validateReview({ rating, comment });
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await onSubmit({ rating, comment: comment.trim() });
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {formError}
        </p>
      )}
      <StarInput
        value={rating}
        onChange={(n) => {
          setRating(n);
          if (errors.rating) setErrors((errs) => ({ ...errs, rating: undefined }));
        }}
        error={errors.rating}
        disabled={submitting}
      />
      <TextAreaField
        id="review-comment"
        label="Your review"
        rows={4}
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          if (errors.comment) setErrors((errs) => ({ ...errs, comment: undefined }));
        }}
        error={errors.comment}
        hint={`${comment.trim().length}/${REVIEW_MAX_LENGTH} characters · at least 10`}
        maxLength={REVIEW_MAX_LENGTH}
        placeholder="What did you like or dislike? How are you using it?"
        disabled={submitting}
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? busyLabel : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
