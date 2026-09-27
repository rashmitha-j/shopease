import { createContext } from 'react';

// { items, totals, addItem, setQuantity, removeItem, clearCart, syncWithLatest }; provided by <CartProvider>
export const CartContext = createContext(null);
