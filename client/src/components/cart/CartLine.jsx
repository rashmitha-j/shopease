import { Link } from 'react-router';
import { useCart } from '../../hooks/useCart.js';
import { formatPrice } from '../../utils/format.js';
import { maxQuantityFor } from '../../utils/cart.js';
import QuantityStepper from './QuantityStepper.jsx';

export default function CartLine({ item }) {
  const { setQuantity, removeItem } = useCart();
  const outOfStock = item.stock < 1;
  const href = `/products/${item.slug}`;

  return (
    <li className="flex gap-4 py-5">
      <Link to={href} className="size-24 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 sm:size-28">
        {item.image && (
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            className={`size-full object-cover ${outOfStock ? 'opacity-50' : ''}`}
          />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">{item.brand}</p>
          <Link to={href} className="line-clamp-2 font-medium text-gray-900 hover:text-brand-700">
            {item.name}
          </Link>
          <p className="mt-1 text-sm text-gray-600">{formatPrice(item.price)} each</p>
          {outOfStock ? (
            <p className="mt-1 text-sm font-semibold text-red-700">Out of stock, not included in the total</p>
          ) : (
            item.stock <= 5 && <p className="mt-1 text-sm text-amber-700">Only {item.stock} left</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
          {!outOfStock && (
            <QuantityStepper
              value={item.quantity}
              max={maxQuantityFor(item.stock)}
              onChange={(q) => setQuantity(item.productId, q)}
              label={`Quantity of ${item.name}`}
            />
          )}
          <div className="flex flex-col items-end gap-1">
            {!outOfStock && <p className="font-semibold">{formatPrice(item.price * item.quantity)}</p>}
            <button
              type="button"
              onClick={() => removeItem(item.productId)}
              className="text-sm font-medium text-gray-500 hover:text-red-700"
              aria-label={`Remove ${item.name} from cart`}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
