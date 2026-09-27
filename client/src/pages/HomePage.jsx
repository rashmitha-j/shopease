import { Link } from 'react-router';

export default function HomePage() {
  return (
    <section className="rounded-2xl bg-linear-to-br from-brand-600 to-brand-700 px-6 py-16 text-center text-white sm:px-12 sm:py-24">
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Everything you need, in one place</h1>
      <p className="mx-auto mt-4 max-w-xl text-brand-100 sm:text-lg">
        Electronics, fashion, home, books, sports and beauty at great prices.
      </p>
      <Link
        to="/products"
        className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
      >
        Shop now
      </Link>
    </section>
  );
}
