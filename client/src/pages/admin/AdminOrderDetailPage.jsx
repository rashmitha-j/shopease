import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useApi } from '../../hooks/useApi.js';
import { updateOrderStatus } from '../../api/adminOrders.js';
import { formatDateTime, needsRefund, shortOrderId } from '../../utils/orders.js';
import OrderStatusBadge from '../../components/orders/OrderStatusBadge.jsx';
import { OrderItemsSection, PaymentSection, ShippingAddressSection } from '../../components/orders/OrderSections.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { EmptyState, ErrorState } from '../../components/ui/StatusMessage.jsx';

// One entry per status the server may allow next (it sends `allowedStatuses`)
const ACTIONS = {
  shipped: {
    label: 'Mark as shipped',
    title: 'Mark this order as shipped?',
    message: 'The customer will see it as shipped and will no longer be able to cancel it.',
    done: 'Order marked as shipped.',
    danger: false,
  },
  delivered: {
    label: 'Mark as delivered',
    title: 'Mark this order as delivered?',
    message: 'This is the final step and can’t be undone.',
    done: 'Order marked as delivered.',
    danger: false,
  },
  cancelled: {
    label: 'Cancel order',
    title: 'Cancel this order?',
    message: 'The order will be cancelled and its items put back in stock. This can’t be undone.',
    done: 'Order cancelled and stock restored.',
    danger: true,
    keepLabel: 'Keep order', // avoids "Cancel" next to "Cancel order"
  },
};

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const { data, error, retry } = useApi(`/admin/orders/${encodeURIComponent(id)}`);
  const [updated, setUpdated] = useState(null); // the order as returned by the last status change
  const [pending, setPending] = useState(null); // status waiting for confirmation
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [flash, setFlash] = useState('');

  if (error?.status === 404 || error?.status === 400) {
    return (
      <>
        <BackLink />
        <div className="mt-6">
          <EmptyState title="Order not found" message="Check the link, or find the order in the list." />
        </div>
      </>
    );
  }
  if (error) return <ErrorState message={error.message} onRetry={retry} />;

  const order = updated?._id === id ? updated : data?.order;
  if (!order || order._id !== id) {
    return <div className="h-96 animate-pulse rounded-2xl bg-gray-200" aria-busy="true" aria-label="Loading order" />;
  }

  const confirm = async () => {
    setSaving(true);
    setActionError('');
    try {
      const res = await updateOrderStatus(order._id, pending);
      setUpdated(res.order);
      setFlash(ACTIONS[pending].done);
      setPending(null);
    } catch (err) {
      // e.g. 409 when the order changed meanwhile (paid, cancelled by the customer, expired)
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const reloadAfterConflict = () => {
    setPending(null);
    setUpdated(null);
    retry();
  };

  const action = pending && ACTIONS[pending];
  const address = order.shippingAddress;

  return (
    <>
      <title>{`Admin: Order ${shortOrderId(order._id)} | ShopEase`}</title>
      <BackLink />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Order {shortOrderId(order._id)}</h1>
            <OrderStatusBadge order={order} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Placed on {formatDateTime(order.createdAt)} · <span className="font-mono text-xs">{order._id}</span>
          </p>
        </div>
      </div>

      {flash && (
        <div role="status" className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>{flash}</span>
          <button type="button" onClick={() => setFlash('')} className="font-medium hover:text-green-950" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <section aria-labelledby="status-heading" className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 id="status-heading" className="text-lg font-semibold">
          Update status
        </h2>
        {order.allowedStatuses.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {order.allowedStatuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setActionError('');
                  setFlash('');
                  setPending(status);
                }}
                className={
                  ACTIONS[status].danger
                    ? 'rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50'
                    : 'rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700'
                }
              >
                {ACTIONS[status].label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-600">This order is {order.status === 'delivered' ? 'delivered' : 'cancelled'}; no further changes are possible.</p>
        )}
        <StatusHelp order={order} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <OrderItemsSection items={order.items} />
        <div className="space-y-6">
          <section aria-labelledby="customer-heading" className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 id="customer-heading" className="text-lg font-semibold">
              Customer
            </h2>
            <dl className="mt-3 space-y-1 text-sm">
              <div>
                <dt className="sr-only">Name</dt>
                <dd className="font-medium text-gray-900">{order.user?.name ?? 'Account deleted'}</dd>
              </div>
              {order.user?.email && (
                <div>
                  <dt className="sr-only">Email</dt>
                  <dd>
                    <a href={`mailto:${order.user.email}`} className="text-brand-600 hover:text-brand-700">
                      {order.user.email}
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt className="sr-only">Phone</dt>
                <dd>
                  <a href={`tel:+91${address.phone}`} className="text-brand-600 hover:text-brand-700">
                    +91 {address.phone}
                  </a>
                </dd>
              </div>
            </dl>
          </section>
          <PaymentSection order={order} />
          <ShippingAddressSection address={address} />
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        title={action?.title}
        message={action?.message}
        confirmLabel={action?.label}
        cancelLabel={action?.keepLabel ?? 'Not now'}
        danger={action?.danger}
        busy={saving}
        error={
          actionError && (
            <>
              {actionError}{' '}
              <button type="button" onClick={reloadAfterConflict} className="font-semibold underline">
                Reload order
              </button>
            </>
          )
        }
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </>
  );
}

function BackLink() {
  return (
    <Link to="/admin/orders" className="text-sm font-medium text-brand-600 hover:text-brand-700">
      ← All orders
    </Link>
  );
}

// Explains why an action is missing, so admins aren't left guessing
function StatusHelp({ order }) {
  let text = '';
  if (order.status === 'awaiting_payment') {
    text = 'This online order can’t ship until the customer pays. Unpaid orders are cancelled automatically after 30 minutes.';
  } else if (order.status === 'confirmed' && order.paymentStatus === 'paid') {
    text = 'This order is paid online, so it can’t be cancelled here: refunds aren’t supported yet.';
  } else if (order.status === 'shipped') {
    text = 'Shipped orders can’t be cancelled.';
  } else if (needsRefund(order)) {
    text = 'This order was paid after it was cancelled. The payment needs to be refunded from the Razorpay dashboard.';
  }
  return text ? <p className="mt-3 text-sm text-gray-500">{text}</p> : null;
}
