import { Link } from 'react-router';

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight">Log in</h1>
      <p className="mt-2 text-gray-600">The login form will appear here.</p>
      <p className="mt-6 text-sm text-gray-600">
        New to ShopEase?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Create an account
        </Link>
      </p>
    </section>
  );
}
