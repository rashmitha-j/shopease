const buttonClass =
  'flex size-10 items-center justify-center text-lg text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent';

export default function QuantityStepper({ value, min = 1, max, onChange, label }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white shadow-sm" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className={`${buttonClass} rounded-l-xl`}
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
        className={`${buttonClass} rounded-r-xl`}
      >
        +
      </button>
    </div>
  );
}
