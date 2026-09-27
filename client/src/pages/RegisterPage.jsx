import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';
import AuthCard from '../components/auth/AuthCard.jsx';
import { PasswordField, TextField } from '../components/ui/TextField.jsx';
import { NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH, validateRegister } from '../utils/validation.js';
import { getRedirectPath } from '../utils/redirect.js';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const location = useLocation();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Signed up (or already logged in): go back to where the user came from
  if (user) return <Navigate to={getRedirectPath(location)} replace />;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((errs) => ({ ...errs, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validateRegister(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await register({ name: values.name.trim(), email: values.email.trim(), password: values.password });
    } catch (err) {
      // 409: the email is taken, so show it next to the email field
      if (err.status === 409) setErrors({ email: err.message });
      else setFormError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <title>Create an account | ShopEase</title>
      <AuthCard
        title="Create an account"
        subtitle="Sign up to start shopping."
        formError={formError}
        footer={
          <>
            Already have an account?{' '}
            <Link to="/login" state={location.state} className="font-semibold text-brand-600 hover:text-brand-700">
              Log in
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <TextField
            id="name"
            label="Full name"
            autoComplete="name"
            maxLength={NAME_MAX_LENGTH}
            value={values.name}
            onChange={handleChange}
            error={errors.name}
            autoFocus
          />
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={handleChange}
            error={errors.email}
          />
          <PasswordField
            id="password"
            label="Password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            value={values.password}
            onChange={handleChange}
            error={errors.password}
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </AuthCard>
    </>
  );
}
