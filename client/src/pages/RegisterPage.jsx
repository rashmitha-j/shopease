import { Link } from 'react-router';

export default function RegisterPage() {
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
      <p className="mt-2 text-gray-600">The sign-up form will appear here.</p>
      <p className="mt-6 text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Log in
        </Link>
      </p>
    </section>
  );
}
