import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <section className="py-16 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-gray-600">Sorry, we couldn’t find the page you’re looking for.</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Go home
      </Link>
    </section>
  );
}
