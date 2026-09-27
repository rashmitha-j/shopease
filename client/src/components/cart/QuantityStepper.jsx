const buttonClass =
  'flex size-9 items-center justify-center text-lg text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent';

export default function QuantityStepper({ value, min = 1, max, onChange, label }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-300 bg-white" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className={`${buttonClass} rounded-l-lg`}
      >
        −
      </button>
      <output className="w-10 text-center text-sm font-semibold" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Increase quantity"
        className={`${buttonClass} rounded-r-lg`}
      >
        +
      </button>
    </div>
  );
}
