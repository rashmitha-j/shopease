import { useEffect, useMemo, useReducer } from 'react';
import { CartContext } from './cart-context.js';
import { STORAGE_KEY, cartReducer, cartTotals, parseStoredCart } from '../utils/cart.js';

// The backend has no cart API yet, so the cart lives in this browser's localStorage.
// localStorage can throw (private mode, storage disabled), so every access is guarded.
const loadCart = () => {
  try {
    return parseStoredCart(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
};

export default function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, undefined, loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage unavailable: the cart still works until the page is closed
    }
  }, [items]);

  // Keep the cart in sync when it changes in another tab
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) dispatch({ type: 'replace', items: parseStoredCart(e.newValue) });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // dispatch never changes, so these functions are created once and stay stable
  const actions = useMemo(
    () => ({
      addItem: (product, quantity = 1) => dispatch({ type: 'add', product, quantity }),
      setQuantity: (productId, quantity) => dispatch({ type: 'setQuantity', productId, quantity }),
      removeItem: (productId) => dispatch({ type: 'remove', productId }),
      clearCart: () => dispatch({ type: 'clear' }),
      syncWithLatest: (latest) => dispatch({ type: 'sync', latest }),
    }),
    [],
  );

  const value = useMemo(() => ({ items, totals: cartTotals(items), ...actions }), [items, actions]);

  return <CartContext value={value}>{children}</CartContext>;
}
