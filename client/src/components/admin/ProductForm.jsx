import { useState } from 'react';
import { Link } from 'react-router';
import { useApi } from '../../hooks/useApi.js';
import { TextAreaField, TextField } from '../ui/TextField.jsx';
import { validateProduct } from '../../utils/validation.js';

// Shared by "Add product" and "Edit product". `onSubmit(values)` saves and may throw an ApiError.
export default function ProductForm({ initialValues, submitLabel, busyLabel, onSubmit }) {
  const { data: categoryData, error: categoryError } = useApi('/products/categories');
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValues((v) => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((errs) => ({ ...errs, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validateProduct(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      // e.g. a server-side validation message, 403 if no longer an admin, 404 if deleted meanwhile
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  const field = (id, label, props = {}) => (
    <TextField id={id} label={label} value={values[id]} onChange={handleChange} error={errors[id]} {...props} />
  );
  const previewUrl = !errors.imageUrl && /^https?:\/\//i.test(values.imageUrl.trim()) ? values.imageUrl.trim() : '';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {formError}
        </div>
      )}

      <fieldset disabled={submitting} className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="mb-5 text-lg font-semibold">Details</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">{field('name', 'Product name', { maxLength: 120 })}</div>
            {field('brand', 'Brand', { maxLength: 50 })}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-900">
                Category
              </label>
              <select
                id="category"
                name="category"
                value={values.category}
                onChange={handleChange}
                aria-invalid={errors.category ? true : undefined}
                aria-describedby={errors.category ? 'category-error' : undefined}
                className={`mt-1.5 block w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm focus:ring-2 focus:outline-none ${
                  errors.category
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                    : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100'
                }`}
              >
                <option value="">{categoryData ? 'Select a category' : 'Loading…'}</option>
                {/* Keep the product's current category selectable even before the list loads */}
                {!categoryData && values.category && <option value={values.category}>{values.category}</option>}
                {categoryData?.categories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p id="category-error" className="mt-1.5 text-sm text-red-600">
                  {errors.category}
                </p>
              )}
              {categoryError && <p className="mt-1.5 text-sm text-red-600">Couldn’t load categories.</p>}
            </div>
            <div className="sm:col-span-2">
              <TextAreaField
                id="description"
                label="Description"
                value={values.description}
                onChange={handleChange}
                error={errors.description}
                maxLength={2000}
                hint={`${values.description.length}/2000 characters`}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="mb-5 text-lg font-semibold">Price and stock</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {field('price', 'Price (₹)', { type: 'number', inputMode: 'decimal', min: 0, step: '0.01' })}
            {field('mrp', 'MRP (₹, optional)', {
              type: 'number',
              inputMode: 'decimal',
              min: 0,
              step: '0.01',
              hint: 'Original price, shown struck through.',
            })}
            {field('stock', 'Stock', { type: 'number', inputMode: 'numeric', min: 0, step: 1 })}
          </div>
          <label className="mt-5 flex items-center gap-2 text-sm text-gray-900">
            <input
              type="checkbox"
              name="isFeatured"
              checked={values.isFeatured}
              onChange={handleChange}
              className="size-4 accent-brand-600"
            />
            Feature on the home page
          </label>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="mb-5 text-lg font-semibold">Image</h2>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex-1">
              {field('imageUrl', 'Image URL', { type: 'url', placeholder: 'https://…', hint: 'A direct link to a square image works best.' })}
            </div>
            <div className="size-28 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-xs text-gray-400">No preview</span>
              )}
            </div>
          </div>
        </section>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          to="/admin/products"
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? busyLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
