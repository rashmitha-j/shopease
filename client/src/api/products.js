import { api } from './client.js';

// Admin-only product operations (the server requires an admin access token)
export const createProduct = (product) => api('/products', { method: 'POST', body: product });
export const updateProduct = (id, changes) => api(`/products/${id}`, { method: 'PATCH', body: changes });
export const deleteProduct = (id) => api(`/products/${id}`, { method: 'DELETE' });
