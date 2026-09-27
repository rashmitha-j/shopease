import { useSearchParams } from 'react-router';

export default function ProductsPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q');

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{q ? `Results for “${q}”` : 'All products'}</h1>
      <p className="mt-2 text-gray-600">The product listing with filters and pagination will appear here.</p>
    </section>
  );
}
