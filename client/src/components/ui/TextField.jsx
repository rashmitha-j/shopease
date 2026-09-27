import { useState } from 'react';

const inputClass = (error) =>
  `block w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:ring-2 focus:outline-none ${
    error
      ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
      : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100'
  }`;

function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-900">
        {label}
      </label>
      <div className="relative mt-1.5">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-sm text-gray-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const describedBy = (id, error, hint) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export function TextField({ id, label, error, hint, ...inputProps }) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={inputClass(error)}
        {...inputProps}
      />
    </Field>
  );
}

export function PasswordField({ id, label, error, hint, ...inputProps }) {
  const [visible, setVisible] = useState(false);

  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        name={id}
        type={visible ? 'text' : 'password'}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${inputClass(error)} pr-16`}
        {...inputProps}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-controls={id}
        className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-gray-500 hover:text-gray-900"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </Field>
  );
}

export function TextAreaField({ id, label, error, hint, rows = 5, ...textareaProps }) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        name={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${inputClass(error)} resize-y`}
        {...textareaProps}
      />
    </Field>
  );
}
