import { Link, useParams } from 'react-router';

export default function ProductDetailPage() {
  const { slug } = useParams();

  return (
    <section>
      <Link to="/products" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Back to products
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Product details</h1>
      <p className="mt-2 text-gray-600">
        Details for <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">{slug}</code> will appear here.
      </p>
    </section>
  );
}
