import { Link } from 'react-router';
import { formatPrice } from '../../utils/format.js';
import { PAYMENT_METHOD_LABELS, formatDateTime } from '../../utils/orders.js';

// Order sections shared by the customer's order page and the admin order page

export function OrderItemsSection({ items }) {
  return (
    <section aria-labelledby="items-heading" className="rounded-2xl border border-gray-200 bg-white px-5 sm:px-6">
      <h2 id="items-heading" className="pt-5 text-lg font-semibold">
        Items
      </h2>
      <ul className="divide-y divide-gray-200">
        {items.map((item) => (
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
  );
}

export function PaymentSection({ order }) {
  return (
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
  );
}

export function ShippingAddressSection({ address }) {
  return (
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
  );
}
