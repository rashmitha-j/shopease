import { Link, useSearchParams } from 'react-router';
import { useApi } from '../../hooks/useApi.js';
import { formatPrice } from '../../utils/format.js';
import { PAYMENT_METHOD_LABELS, STATUS_INFO, formatDateTime, shortOrderId } from '../../utils/orders.js';
import OrderStatusBadge from '../../components/orders/OrderStatusBadge.jsx';
import Pagination from '../../components/products/Pagination.jsx';
import { EmptyState, ErrorState } from '../../components/ui/StatusMessage.jsx';

const PAGE_SIZE = 20;
const FILTERS = ['q', 'status', 'paymentStatus', 'paymentMethod'];

const selectClass =
  'w-full rounded-lg border border-gray-300 bg-white py-2 pr-8 pl-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none';

export default function AdminOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(Number.parseInt(searchParams.get('page'), 10) || 1, 1);
  const filters = Object.fromEntries(FILTERS.map((key) => [key, searchParams.get(key)?.trim() ?? '']));
  const hasFilters = FILTERS.some((key) => filters[key]);

  const apiParams = new URLSearchParams({ page, limit: PAGE_SIZE });
  for (const key of FILTERS) if (filters[key]) apiParams.set(key, filters[key]);
  const { data, error, loading, retry } = useApi(`/admin/orders?${apiParams}`);

  const updateFilters = (changes) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('page');
    setSearchParams(next);
  };

  return (
    <>
      <title>Admin: Orders | ShopEase</title>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Orders</h1>

      <form
        role="search"
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          updateFilters({ q: new FormData(e.currentTarget).get('q').trim() });
        }}
      >
        <label htmlFor="admin-order-search" className="sr-only">
          Search orders
        </label>
        <input
          key={filters.q}
          id="admin-order-search"
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder="Order # (e.g. A1B2C3), customer name, email or phone"
          maxLength={100}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
        <button type="submit" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Search
        </button>
      </form>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm text-gray-700">
          <span className="mb-1 block text-xs font-medium text-gray-500">Order status</span>
          <select value={filters.status} onChange={(e) => updateFilters({ status: e.target.value })} className={selectClass}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_INFO).map(([value, info]) => (
              <option key={value} value={value}>
                {info.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-700">
          <span className="mb-1 block text-xs font-medium text-gray-500">Payment</span>
          <select value={filters.paymentStatus} onChange={(e) => updateFilters({ paymentStatus: e.target.value })} className={selectClass}>
            <option value="">Paid and unpaid</option>
            <option value="paid">Paid</option>
            <option value="pending">Not paid yet</option>
          </select>
        </label>
        <label className="text-sm text-gray-700">
          <span className="mb-1 block text-xs font-medium text-gray-500">Method</span>
          <select value={filters.paymentMethod} onChange={(e) => updateFilters({ paymentMethod: e.target.value })} className={selectClass}>
            <option value="">All methods</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5">
        {error ? (
          <ErrorState message={error.message} onRetry={retry} />
        ) : !data ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading orders">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : data.orders.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No orders match' : 'No orders yet'}
            message={hasFilters ? 'Try a different search or filter.' : 'Orders will appear here when customers check out.'}
          >
            {hasFilters && (
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear filters
              </button>
            )}
          </EmptyState>
        ) : (
          <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
            <p className="mb-2 text-sm text-gray-600" aria-live="polite">
              {data.total} {data.total === 1 ? 'order' : 'orders'}
            </p>
            <OrderTable orders={data.orders} />
            <OrderCards orders={data.orders} />
            <div className="mt-6">
              <Pagination
                page={data.page}
                pages={data.pages}
                getSearch={(n) => {
                  const next = new URLSearchParams(searchParams);
                  if (n === 1) next.delete('page');
                  else next.set('page', n);
                  return next.toString() ? `?${next}` : '';
                }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const itemCount = (order) => order.items.reduce((sum, i) => sum + i.quantity, 0);

// Deleted customer accounts leave `user` as null
const Customer = ({ order }) => (
  <>
    <p className="truncate font-medium text-gray-900">{order.user?.name ?? order.shippingAddress.fullName}</p>
    <p className="truncate text-xs text-gray-500">{order.user?.email ?? 'Account deleted'}</p>
  </>
);

function PaymentBadge({ order }) {
  const paid = order.paymentStatus === 'paid';
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span className="text-xs text-gray-600">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paid ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}
      >
        {paid ? 'Paid' : 'Not paid'}
      </span>
    </span>
  );
}

// Desktop: table
function OrderTable({ orders }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white md:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs tracking-wide text-gray-500 uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Order</th>
            <th scope="col" className="px-4 py-3 font-medium">Customer</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Items</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
            <th scope="col" className="px-4 py-3 font-medium">Payment</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((order) => (
            <tr key={order._id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link to={`/admin/orders/${order._id}`} className="font-semibold text-brand-600 hover:text-brand-700">
                  {shortOrderId(order._id)}
                </Link>
                <p className="text-xs whitespace-nowrap text-gray-500">{formatDateTime(order.createdAt)}</p>
              </td>
              <td className="max-w-56 px-4 py-3">
                <Customer order={order} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{itemCount(order)}</td>
              <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">{formatPrice(order.totalAmount)}</td>
              <td className="px-4 py-3">
                <PaymentBadge order={order} />
              </td>
              <td className="px-4 py-3">
                <OrderStatusBadge order={order} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Phones: cards
function OrderCards({ orders }) {
  return (
    <ul className="space-y-3 md:hidden">
      {orders.map((order) => (
        <li key={order._id}>
          <Link to={`/admin/orders/${order._id}`} className="block rounded-2xl border border-gray-200 bg-white p-4 hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-brand-600">{shortOrderId(order._id)}</span>
              <OrderStatusBadge order={order} />
            </div>
            <div className="mt-2 min-w-0 text-sm">
              <Customer order={order} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-2 text-sm">
              <div>
                <p className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</p>
                <p className="mt-1">
                  <span className="font-semibold tabular-nums">{formatPrice(order.totalAmount)}</span>
                  <span className="text-gray-500"> · {itemCount(order)} items</span>
                </p>
              </div>
              <PaymentBadge order={order} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
