import { useState } from 'react';
import { Link } from 'react-router';
import { useCart } from '../../hooks/useCart.js';
import { maxQuantityFor } from '../../utils/cart.js';
import QuantityStepper from './QuantityStepper.jsx';

export default function AddToCart({ product }) {
  const { items, addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(0); // how many were just added, for the confirmation message

  const inCart = items.find((i) => i.productId === product._id)?.quantity ?? 0;
  const remaining = maxQuantityFor(product.stock) - inCart;
  const chosen = Math.min(quantity, Math.max(remaining, 1));

  if (product.stock === 0) {
    return (
      <button
        type="button"
        disabled
        className="mt-6 w-full cursor-not-allowed rounded-lg bg-gray-200 px-6 py-3 font-semibold text-gray-500 sm:w-auto"
      >
        Out of stock
      </button>
    );
  }

  const handleAdd = () => {
    addItem(product, chosen);
    setAdded(chosen);
    setQuantity(1);
  };

  return (
    <div className="mt-6">
      {remaining > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <QuantityStepper value={chosen} max={remaining} onChange={setQuantity} label="Quantity" />
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 sm:flex-none"
          >
            Add to cart
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-700">
          You have the maximum quantity ({inCart}) of this item in your cart.
        </p>
      )}

      <p role="status" className="mt-3 min-h-5 text-sm">
        {added > 0 && (
          <>
            <span className="font-medium text-green-700">
              Added {added} to your cart.
            </span>{' '}
            <Link to="/cart" className="font-semibold text-brand-600 hover:text-brand-700">
              View cart →
            </Link>
          </>
        )}
        {added === 0 && inCart > 0 && (
          <span className="text-gray-600">
            {inCart} already in your cart.{' '}
            <Link to="/cart" className="font-semibold text-brand-600 hover:text-brand-700">
              View cart →
            </Link>
          </span>
        )}
      </p>
    </div>
  );
}
