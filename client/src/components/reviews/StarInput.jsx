import { useState } from 'react';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

// Star picker built from real radio buttons, so it works with the keyboard
// (Tab to focus, arrow keys to change) and screen readers.
export default function StarInput({ value, onChange, error, disabled }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <fieldset disabled={disabled}>
      <legend className="block text-sm font-medium text-slate-900">Your rating</legend>
      <div className="mt-1.5 flex items-center gap-3" onMouseLeave={() => setHover(0)}>
        <div className="flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              onMouseEnter={() => setHover(n)}
              className="cursor-pointer rounded px-0.5 text-3xl leading-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500"
            >
              <input
                type="radio"
                name="rating"
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                className="sr-only"
                aria-describedby={error ? 'rating-error' : undefined}
              />
              <span aria-hidden="true" className={n <= shown ? 'text-amber-500' : 'text-slate-300'}>
                ★
              </span>
              <span className="sr-only">
                {n} {n === 1 ? 'star' : 'stars'} ({LABELS[n]})
              </span>
            </label>
          ))}
        </div>
        <span className="text-sm text-slate-600" aria-hidden="true">
          {LABELS[shown]}
        </span>
      </div>
      {error && (
        <p id="rating-error" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}
