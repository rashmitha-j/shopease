// Read-only row of five stars, e.g. for a review or an average rating
export default function Stars({ rating, size = 'text-base', className = '' }) {
  const filled = Math.round(rating);
  return (
    <span className={`inline-flex leading-none ${size} ${className}`} role="img" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={n <= filled ? 'text-amber-500' : 'text-gray-300'}>
          ★
        </span>
      ))}
    </span>
  );
}
