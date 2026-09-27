import { Link } from 'react-router';
import { useApi } from '../../hooks/useApi.js';
import { formatPrice } from '../../utils/format.js';
import { ErrorState } from '../../components/ui/StatusMessage.jsx';

const numberFormat = new Intl.NumberFormat('en-IN');

export default function AdminDashboardPage() {
  const { data, error, loading, retry } = useApi('/admin/stats');
  const stats = data?.stats;

  return (
    <>
      <title>Admin dashboard | ShopEase</title>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
        {stats && (
          <button
            type="button"
            onClick={retry}
            disabled={loading}
            className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:text-gray-400"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </div>

      <div className="mt-6">
        {error ? (
          <ErrorState message={error.message} onRetry={retry} />
        ) : !stats ? (
          <DashboardSkeleton />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <StatTile label="Total products" value={stats.totalProducts} />
              <StatTile label="Total orders" value={stats.totalOrders} note="All time, including cancelled" />
              <StatTile
                label="Pending orders"
                value={stats.pendingOrders}
                note={
                  stats.awaitingPayment > 0
                    ? `Confirmed, not shipped · ${stats.awaitingPayment} awaiting payment`
                    : 'Confirmed, not shipped yet'
                }
                highlight={stats.pendingOrders > 0}
              />
              <StatTile
                label="Low-stock products"
                value={stats.lowStock.count}
                note={`${stats.lowStock.threshold} or fewer in stock`}
                highlight={stats.lowStock.count > 0}
              />
            </dl>

            <LowStockTable lowStock={stats.lowStock} />
          </>
        )}
      </div>
    </>
  );
}

function StatTile({ label, value, note, highlight = false }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 sm:p-5 ${highlight ? 'border-amber-300' : 'border-gray-200'}`}>
      <dt className="text-sm font-medium text-gray-600">{label}</dt>
      <dd className="mt-2 text-3xl font-bold tracking-tight text-gray-900 tabular-nums">{numberFormat.format(value)}</dd>
      {note && <dd className="mt-1 text-xs text-gray-500">{note}</dd>}
    </div>
  );
}

function LowStockTable({ lowStock }) {
  const { products, count, threshold } = lowStock;

  return (
    <section aria-labelledby="low-stock-heading" className="mt-8 rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 px-5 py-4">
        <h2 id="low-stock-heading" className="text-lg font-semibold">
          Low stock
        </h2>
        {count > products.length && (
          <p className="text-sm text-gray-500">
            Showing the {products.length} lowest of {count}
          </p>
        )}
      </div>

      {products.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-600">
          All products have more than {threshold} in stock.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs tracking-wide text-gray-500 uppercase">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Product
                </th>
                <th scope="col" className="hidden px-5 py-3 font-medium sm:table-cell">
                  Category
                </th>
                <th scope="col" className="hidden px-5 py-3 text-right font-medium sm:table-cell">
                  Price
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Stock
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p._id}>
                  <td className="px-5 py-3">
                    <Link to={`/products/${p.slug}`} className="flex items-center gap-3 font-medium text-gray-900 hover:text-brand-700">
                      {p.images?.[0]?.url && (
                        <img src={p.images[0].url} alt="" loading="lazy" className="size-10 shrink-0 rounded-md object-cover" />
                      )}
                      <span className="line-clamp-2">{p.name}</span>
                    </Link>
                  </td>
                  <td className="hidden px-5 py-3 text-gray-600 sm:table-cell">{p.category}</td>
                  <td className="hidden px-5 py-3 text-right text-gray-600 tabular-nums sm:table-cell">{formatPrice(p.price)}</td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                        p.stock === 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200" />
        ))}
      </div>
      <div className="mt-8 h-64 animate-pulse rounded-2xl bg-gray-200" />
    </div>
  );
}
