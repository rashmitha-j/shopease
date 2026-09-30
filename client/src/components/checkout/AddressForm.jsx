import { TextField } from '../ui/TextField.jsx';

const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
];

// Controlled form: the checkout page owns the values and errors
export default function AddressForm({ values, errors, onChange, disabled }) {
  const field = (id, label, props = {}) => (
    <TextField id={id} label={label} value={values[id]} onChange={onChange} error={errors[id]} disabled={disabled} {...props} />
  );

  return (
    <fieldset disabled={disabled} className="grid gap-5 sm:grid-cols-2">
      <legend className="sr-only">Shipping address</legend>
      <div className="sm:col-span-2">{field('fullName', 'Full name', { autoComplete: 'name', maxLength: 60 })}</div>
      <div className="sm:col-span-2">
        {field('phone', 'Mobile number', {
          type: 'tel',
          autoComplete: 'tel-national',
          inputMode: 'tel',
          hint: 'For delivery updates. 10 digits, e.g. 98765 43210.',
        })}
      </div>
      <div className="sm:col-span-2">
        {field('line1', 'Address', { autoComplete: 'address-line1', maxLength: 120, placeholder: 'House no., street, area' })}
      </div>
      <div className="sm:col-span-2">
        {field('line2', 'Landmark (optional)', { autoComplete: 'address-line2', maxLength: 120 })}
      </div>
      {field('city', 'City', { autoComplete: 'address-level2', maxLength: 60 })}
      <div>
        <label htmlFor="state" className="block text-sm font-medium text-slate-900">
          State
        </label>
        <select
          id="state"
          name="state"
          value={values.state}
          onChange={onChange}
          autoComplete="address-level1"
          aria-invalid={errors.state ? true : undefined}
          aria-describedby={errors.state ? 'state-error' : undefined}
          className={`mt-1.5 block w-full rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm focus:ring-2 focus:outline-none ${
            errors.state
              ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
              : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
          }`}
        >
          <option value="">Select a state</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {errors.state && (
          <p id="state-error" className="mt-1.5 text-sm text-red-600">
            {errors.state}
          </p>
        )}
      </div>
      {field('postalCode', 'PIN code', { autoComplete: 'postal-code', inputMode: 'numeric', maxLength: 6 })}
    </fieldset>
  );
}
