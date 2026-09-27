import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';
import { useCart } from '../hooks/useCart.js';
import { cancelOrder, placeOrder, verifyPayment } from '../api/orders.js';
import { loadRazorpay } from '../utils/loadRazorpay.js';
import { normalizePhone, validateAddress } from '../utils/validation.js';
import { estimateShipping, FREE_SHIPPING_THRESHOLD, shortOrderId } from '../utils/orders.js';
import { formatPrice } from '../utils/format.js';
import AddressForm from '../components/checkout/AddressForm.jsx';
import { EmptyState } from '../components/ui/StatusMessage.jsx';

const PAYMENT_OPTIONS = [
  { value: 'razorpay', label: 'Pay online', description: 'UPI, cards, net banking and wallets via Razorpay' },
  { value: 'cod', label: 'Cash on delivery', description: 'Pay in cash when your order arrives' },
];

// Razorpay closes its window after this long. It is well inside the server's
// 30-minute window, so an unpaid order is always cancelled by us first.
const PAYMENT_TIMEOUT_SECONDS = 15 * 60;

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, totals, clearCart } = useCart();
  const navigate = useNavigate();

  const [address, setAddress] = useState({
    fullName: user.name,
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
  });
  const [errors, setErrors] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [formError, setFormError] = useState(null); // { message, cartLink? }
  const [step, setStep] = useState('idle'); // 'idle' | 'placing' | 'paying' | 'verifying' | 'done'
  const busy = step !== 'idle';

  const hasOutOfStock = items.some((i) => i.stock < 1);
  const shipping = estimateShipping(totals.subtotal);

  // Keep the checkout visible while the order is being placed, even after the cart is emptied
  if (items.length === 0 && step === 'idle') {
    return (
      <>
        <title>Checkout | ShopEase</title>
        <EmptyState title="Your cart is empty" message="Add some products before checking out.">
          <Link
            to="/products"
            className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Browse products
          </Link>
        </EmptyState>
      </>
    );
  }

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setAddress((a) => ({ ...a, [name]: value }));
    if (errors[name]) setErrors((errs) => ({ ...errs, [name]: undefined }));
  };

  // Order placed and paid (or cash on delivery): show it and empty the cart
  const finish = (orderId) => {
    setStep('done');
    navigate(`/orders/${orderId}`, { replace: true, state: { justPlaced: true } });
    clearCart();
  };

  const fail = (message, cartLink = false) => {
    setFormError({ message, cartLink });
    setStep('idle');
  };

  const openRazorpay = async (order, razorpay) => {
    let Razorpay;
    try {
      Razorpay = await loadRazorpay();
    } catch (err) {
      await cancelOrder(order._id).catch(() => {}); // release the reserved stock
      return fail(err.message);
    }

    let paymentCompleted = false;
    const checkout = new Razorpay({
      key: razorpay.keyId,
      order_id: razorpay.orderId,
      amount: razorpay.amount,
      currency: razorpay.currency,
      name: 'ShopEase',
      description: `Order ${shortOrderId(order._id)}`,
      prefill: { name: address.fullName, email: user.email, contact: normalizePhone(address.phone) },
      notes: { orderId: order._id },
      theme: { color: '#4f46e5' },
      timeout: PAYMENT_TIMEOUT_SECONDS,
      handler: async (payment) => {
        paymentCompleted = true;
        setStep('verifying');
        try {
          await verifyPayment(order._id, payment);
          finish(order._id);
        } catch (err) {
          // The money may have been taken, so never cancel here: show the order and explain.
          // 409 = the order expired first and will be refunded. Otherwise we couldn't reach the server.
          navigate(`/orders/${order._id}`, {
            replace: true,
            state: {
              paymentProblem:
                err.status === 409
                  ? err.message
                  : 'We couldn’t confirm your payment yet. If money was deducted, it will be matched to this order or refunded.',
            },
          });
        }
      },
      modal: {
        confirm_close: true, // ask before closing the payment window
        ondismiss: async () => {
          if (paymentCompleted) return;
          // Closed without paying (or timed out): cancel so the stock is released straight away
          await cancelOrder(order._id).catch(() => {});
          fail('Payment was cancelled, so your order was not placed. Your cart has not changed.');
        },
      },
    });

    checkout.on('payment.failed', (response) => {
      // Razorpay keeps its window open so the customer can retry with another method
      setFormError({ message: `Payment failed: ${response.error?.description ?? 'please try again.'}` });
    });

    setStep('paying');
    checkout.open();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validateAddress(address);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length || hasOutOfStock) return;

    setStep('placing');
    try {
      const { order, razorpay } = await placeOrder({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        shippingAddress: {
          ...address,
          fullName: address.fullName.trim(),
          phone: normalizePhone(address.phone),
          postalCode: address.postalCode.trim(),
        },
        paymentMethod,
      });

      if (paymentMethod === 'cod') finish(order._id);
      else await openRazorpay(order, razorpay);
    } catch (err) {
      // 409: stock or availability changed since the cart was filled
      fail(err.message, err.status === 409);
    }
  };

  const submitLabel = {
    idle: paymentMethod === 'cod' ? 'Place order' : `Pay ${formatPrice(totals.subtotal + shipping)}`,
    placing: 'Placing order…',
    paying: 'Complete payment in the Razorpay window…',
    verifying: 'Confirming payment…',
    done: 'Order placed',
  }[step];

  return (
    <>
      <title>Checkout | ShopEase</title>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Checkout</h1>

      <form onSubmit={handleSubmit} noValidate className="mt-6 lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-8">
        <div className="space-y-6">
          <section aria-labelledby="address-heading" className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 id="address-heading" className="mb-5 text-lg font-semibold">
              Shipping address
            </h2>
            <AddressForm values={address} errors={errors} onChange={handleAddressChange} disabled={busy} />
          </section>

          <section aria-labelledby="payment-heading" className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 id="payment-heading" className="mb-4 text-lg font-semibold">
              Payment method
            </h2>
            <fieldset disabled={busy} className="space-y-3">
              <legend className="sr-only">Payment method</legend>
              {PAYMENT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                    paymentMethod === option.value
                      ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={option.value}
                    checked={paymentMethod === option.value}
                    onChange={() => setPaymentMethod(option.value)}
                    className="mt-1 accent-brand-600"
                  />
                  <span>
                    <span className="block font-medium text-gray-900">{option.label}</span>
                    <span className="block text-sm text-gray-600">{option.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </section>
        </div>

        <aside
          aria-labelledby="checkout-summary-heading"
          className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 lg:sticky lg:top-24 lg:mt-0"
        >
          <h2 id="checkout-summary-heading" className="text-lg font-semibold">
            Order summary
          </h2>
          <ul className="mt-4 divide-y divide-gray-100 text-sm">
            {items.map((item) => (
              <li key={item.productId} className="flex gap-3 py-3">
                {item.image && (
                  <img src={item.image} alt="" className="size-12 shrink-0 rounded-md border border-gray-200 object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-gray-900">{item.name}</p>
                  <p className="text-gray-500">
                    Qty {item.quantity}
                    {item.stock < 1 && <span className="ml-2 font-semibold text-red-700">Out of stock</span>}
                  </p>
                </div>
                <p className="font-medium">{formatPrice(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-2 space-y-2 border-t border-gray-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Items ({totals.count})</dt>
              <dd>{formatPrice(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Shipping</dt>
              <dd>{shipping === 0 ? <span className="text-green-700">Free</span> : formatPrice(shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatPrice(totals.subtotal + shipping)}</dd>
            </div>
          </dl>
          {shipping > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Add {formatPrice(FREE_SHIPPING_THRESHOLD - totals.subtotal)} more for free shipping.
            </p>
          )}

          {formError && (
            <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {formError.message}
              {formError.cartLink && (
                <>
                  {' '}
                  <Link to="/cart" className="font-semibold underline">
                    Review your cart
                  </Link>
                </>
              )}
            </div>
          )}
          {hasOutOfStock && (
            <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Some items are out of stock.{' '}
              <Link to="/cart" className="font-semibold underline">
                Remove them from your cart
              </Link>{' '}
              to continue.
            </p>
          )}

          <button
            type="submit"
            disabled={busy || hasOutOfStock}
            className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitLabel}
          </button>
          <p className="mt-2 text-center text-xs text-gray-500">
            The final total is confirmed by our server when you place the order.
          </p>
        </aside>
      </form>
    </>
  );
}
