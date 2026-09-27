export default function StarRating({ rating, numReviews, className = '' }) {
  return (
    <p className={`flex items-center gap-1 text-sm text-gray-600 ${className}`}>
      <span className="text-amber-500" aria-hidden="true">
        ★
      </span>
      <span className="font-medium text-gray-900">{rating.toFixed(1)}</span>
      <span>
        ({numReviews} {numReviews === 1 ? 'review' : 'reviews'})
      </span>
      <span className="sr-only">Rated {rating.toFixed(1)} out of 5</span>
    </p>
  );
}
