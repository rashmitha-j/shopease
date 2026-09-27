import { Link, useSearchParams } from 'react-router';
import { useApi } from '../hooks/useApi.js';
import { formatPrice } from '../utils/format.js';
import { formatDateTime, shortOrderId } from '../utils/orders.js';
import OrderStatusBadge from '../components/orders/OrderStatusBadge.jsx';
import Pagination from '../components/products/Pagination.jsx';
import { EmptyState, ErrorState } from '../components/ui/StatusMessage.jsx';

const PAGE_SIZE = 10;
const THUMBNAILS = 4;

export default function OrdersPage() {
  const [searchParams] = useSearchParams();
  const page = Math.max(Number.parseInt(searchParams.get('page'), 10) || 1, 1);
  const { data, error, loading, retry } = useApi(`/orders/mine?page=${page}&limit=${PAGE_SIZE}`);

  return (
    <>
      <title>My orders | ShopEase</title>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My orders</h1>

      <div className="mt-6">
        {error ? (
          <ErrorState message={error.message} onRetry={retry} />
        ) : !data ? (
          <OrdersSkeleton />
        ) : data.orders.length === 0 ? (
          <EmptyState
            title={page > 1 ? 'No orders on this page' : 'No orders yet'}
            message={page > 1 ? undefined : 'When you place an order, it will appear here.'}
          >
            <Link
              to={page > 1 ? '/orders' : '/products'}
              className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {page > 1 ? 'Go to page 1' : 'Start shopping'}
            </Link>
          </EmptyState>
        ) : (
          <>
            <ul className={`space-y-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
              {data.orders.map((order) => (
                <li key={order._id}>
                  <OrderCard order={order} />
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Pagination
                page={data.page}
                pages={data.pages}
                getSearch={(n) => (n === 1 ? '' : `?${new URLSearchParams({ page: n })}`)}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}

function OrderCard({ order }) {
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const extra = order.items.length - THUMBNAILS;

  return (
    <Link
      to={`/orders/${order._id}`}
      className="block rounded-2xl border border-gray-200 bg-white p-4 transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <p className="font-semibold text-gray-900">Order {shortOrderId(order._id)}</p>
          <OrderStatusBadge order={order} />
        </div>
        <p className="text-sm text-gray-500">{formatDateTime(order.createdAt)}</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <ul className="flex -space-x-2" aria-label="Items">
          {order.items.slice(0, THUMBNAILS).map((item) => (
            <li key={item.product}>
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  className="size-12 rounded-lg border-2 border-white object-cover shadow-sm"
                />
              ) : (
                <span className="block size-12 rounded-lg border-2 border-white bg-gray-100" />
              )}
            </li>
          ))}
          {extra > 0 && (
            <li className="flex size-12 items-center justify-center rounded-lg border-2 border-white bg-gray-100 text-xs font-semibold text-gray-600">
              +{extra}
            </li>
          )}
        </ul>
        <div className="text-right">
          <p className="font-semibold">{formatPrice(order.totalAmount)}</p>
          <p className="text-sm text-gray-500">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
      </div>
    </Link>
  );
}

function OrdersSkeleton() {
  return (
    <ul className="space-y-4" aria-busy="true" aria-label="Loading orders">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="h-32 animate-pulse rounded-2xl bg-gray-200" />
      ))}
    </ul>
  );
}
