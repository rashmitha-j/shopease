import { api } from './client.js';

// Customer (the server checks the delivered-order rule and ownership)
export const createReview = (slug, review) =>
  api(`/products/${encodeURIComponent(slug)}/reviews`, { method: 'POST', body: review });
export const updateReview = (id, changes) => api(`/reviews/${id}`, { method: 'PATCH', body: changes });
export const deleteReview = (id) => api(`/reviews/${id}`, { method: 'DELETE' });

// Admin
export const moderateReview = (id, { status, note }) =>
  api(`/admin/reviews/${id}`, { method: 'PATCH', body: { status, note } });
export const adminDeleteReview = (id) => api(`/admin/reviews/${id}`, { method: 'DELETE' });
