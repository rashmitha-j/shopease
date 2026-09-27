import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useApi } from '../hooks/useApi.js';
import { cancelOrder } from '../api/orders.js';
import { formatPrice } from '../utils/format.js';
import {
  PAYMENT_METHOD_LABELS,
  canCancel,
  formatDateTime,
  needsRefund,
  shortOrderId,
} from '../utils/orders.js';
import OrderStatusBadge from '../components/orders/OrderStatusBadge.jsx';
import { EmptyState, ErrorState } from '../components/ui/StatusMessage.jsx';

const STEPS = ['Placed', 'Confirmed', 'Shipped', 'Delivered'];
const STEP_INDEX = { awaiting_payment: 0, confirmed: 1, shipped: 2, delivered: 3 };

export default function OrderDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { data, error, retry } = useApi(`/orders/${encodeURIComponent(id)}`);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState('');

  if (error?.status === 404 || error?.status === 400) {
    return (
      <>
        <title>Order not found | ShopEase</title>
        <EmptyState title="Order not found" message="Check the link, or find the order in your order history.">
          <Link
            to="/orders"
            className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            My orders
          </Link>
        </EmptyState>
      </>
    );
  }
  if (error) return <ErrorState message={error.message} onRetry={retry} />;

  const order = data?.order;
  if (!order || order._id !== id) return <DetailSkeleton />;

  const { justPlaced, paymentProblem } = location.state ?? {};
  const address = order.shippingAddress;

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order? This can’t be undone.')) return;
    setCancelling(true);
    setActionError('');
    try {
      await cancelOrder(order._id);
      retry(); // reload the order to show its new status
    } catch (err) {
      setActionError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <title>{`Order ${shortOrderId(order._id)} | ShopEase`}</title>

      <Link to="/orders" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← My orders
      </Link>

      {justPlaced && order.status !== 'cancelled' && (
        <div role="status" className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-5">
          <p className="text-lg font-semibold text-green-900">Thank you! Your order has been placed.</p>
          <p className="mt-1 text-sm text-green-800">
            {order.paymentStatus === 'paid'
              ? `We received your payment of ${formatPrice(order.totalAmount)}.`
              : `Please keep ${formatPrice(order.totalAmount)} ready to pay on delivery.`}
          </p>
        </div>
      )}
      {paymentProblem && (
        <div role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          {paymentProblem}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Order {shortOrderId(order._id)}</h1>
            <OrderStatusBadge order={order} />
          </div>
          <p className="mt-1 text-sm text-gray-500">Placed on {formatDateTime(order.createdAt)}</p>
        </div>
        {canCancel(order) && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-red-300 hover:text-red-700 disabled:opacity-60"
          >
            {cancelling ? 'Cancelling…' : 'Cancel order'}
          </button>
        )}
      </div>
      {actionError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {actionError}
        </p>
      )}

      <section aria-label="Order progress" className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        {order.status === 'cancelled' ? (
          <div>
            <p className="font-semibold text-gray-900">This order was cancelled</p>
            <p className="mt-1 text-sm text-gray-600">
              {order.cancelReason && `${order.cancelReason}. `}
              {order.cancelledAt && `Cancelled on ${formatDateTime(order.cancelledAt)}.`}
            </p>
            {needsRefund(order) && (
              <p className="mt-2 text-sm font-medium text-red-700">
                Your payment of {formatPrice(order.totalAmount)} was received after the order was cancelled and will be
                refunded.
              </p>
            )}
          </div>
        ) : (
          <>
            <ProgressSteps current={STEP_INDEX[order.status] ?? 0} />
            {order.status === 'awaiting_payment' && (
              <p className="mt-4 text-sm text-amber-800">
                We’re waiting for your payment. Unpaid orders are cancelled automatically after 30 minutes.
              </p>
            )}
          </>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <section aria-labelledby="items-heading" className="rounded-2xl border border-gray-200 bg-white px-5 sm:px-6">
          <h2 id="items-heading" className="pt-5 text-lg font-semibold">
            Items
          </h2>
          <ul className="divide-y divide-gray-200">
            {order.items.map((item) => (
              <li key={item.product} className="flex gap-4 py-4">
                <Link
                  to={`/products/${item.slug}`}
                  className="size-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 sm:size-20"
                >
                  {item.image && <img src={item.image} alt={item.name} loading="lazy" className="size-full object-cover" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/products/${item.slug}`} className="line-clamp-2 font-medium text-gray-900 hover:text-brand-700">
                    {item.name}
                  </Link>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatPrice(item.price)} × {item.quantity}
                  </p>
                </div>
                <p className="font-semibold">{formatPrice(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section aria-labelledby="payment-heading" className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 id="payment-heading" className="text-lg font-semibold">
              Payment
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Items</dt>
                <dd>{formatPrice(order.itemsTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Shipping</dt>
                <dd>{order.shippingFee === 0 ? 'Free' : formatPrice(order.shippingFee)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatPrice(order.totalAmount)}</dd>
              </div>
            </dl>
            <dl className="mt-4 space-y-1 border-t border-gray-200 pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-600">Method</dt>
                <dd className="text-right">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-600">Status</dt>
                <dd className="text-right">
                  {order.paymentStatus === 'paid' ? (
                    <span className="font-medium text-green-700">Paid {order.paidAt && `on ${formatDateTime(order.paidAt)}`}</span>
                  ) : order.status === 'cancelled' ? (
                    'Not charged'
                  ) : order.paymentMethod === 'cod' ? (
                    'Pay on delivery'
                  ) : (
                    'Awaiting payment'
                  )}
                </dd>
              </div>
              {order.razorpay?.paymentId && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-600">Payment ID</dt>
                  <dd className="truncate text-right font-mono text-xs leading-5">{order.razorpay.paymentId}</dd>
                </div>
              )}
            </dl>
          </section>

          <section aria-labelledby="address-heading" className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 id="address-heading" className="text-lg font-semibold">
              Shipping to
            </h2>
            <address className="mt-3 text-sm leading-6 text-gray-700 not-italic">
              <span className="font-medium text-gray-900">{address.fullName}</span>
              <br />
              {address.line1}
              {address.line2 && (
                <>
                  <br />
                  {address.line2}
                </>
              )}
              <br />
              {address.city}, {address.state} {address.postalCode}
              <br />
              Phone: {address.phone}
            </address>
          </section>
        </div>
      </div>
    </>
  );
}

function ProgressSteps({ current }) {
  return (
    <ol className="grid grid-cols-4 gap-2">
      {STEPS.map((label, i) => {
        const done = i <= current;
        return (
          <li key={label} className="flex flex-col items-center text-center" aria-current={i === current ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : done ? 'bg-brand-600' : 'bg-gray-200'}`} />
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  done ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? 'invisible' : i < current ? 'bg-brand-600' : 'bg-gray-200'}`}
              />
            </div>
            <span className={`mt-2 text-xs sm:text-sm ${done ? 'font-medium text-gray-900' : 'text-gray-500'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading order">
      <div className="h-10 w-64 animate-pulse rounded bg-gray-200" />
      <div className="h-24 animate-pulse rounded-2xl bg-gray-200" />
      <div className="h-64 animate-pulse rounded-2xl bg-gray-200" />
    </div>
  );
}
