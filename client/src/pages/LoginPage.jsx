import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';
import AuthCard from '../components/auth/AuthCard.jsx';
import { PasswordField, TextField } from '../components/ui/TextField.jsx';
import { validateLogin } from '../utils/validation.js';
import { getRedirectPath } from '../utils/redirect.js';

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already logged in (or just logged in): go back to where the user came from
  if (user) return <Navigate to={getRedirectPath(location)} replace />;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((errs) => ({ ...errs, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validateLogin(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await login({ email: values.email.trim(), password: values.password });
    } catch (err) {
      setFormError(err.message); // e.g. "Invalid email or password", rate-limit message
      setSubmitting(false);
    }
  };

  return (
    <>
      <title>Log in | ShopEase</title>
      <AuthCard
        title="Log in"
        subtitle="Welcome back to ShopEase."
        formError={formError}
        footer={
          <>
            New to ShopEase?{' '}
            <Link to="/register" state={location.state} className="font-semibold text-brand-600 hover:text-brand-700">
              Create an account
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={handleChange}
            error={errors.email}
            autoFocus
          />
          <PasswordField
            id="password"
            label="Password"
            autoComplete="current-password"
            value={values.password}
            onChange={handleChange}
            error={errors.password}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </AuthCard>
    </>
  );
}
