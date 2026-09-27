import { api } from './client.js';

// Admin only. Resolves with { order } including `allowedStatuses`; the server decides
// which status changes are valid and rejects anything else with a 409.
export const updateOrderStatus = (orderId, status) =>
  api(`/admin/orders/${orderId}/status`, { method: 'PATCH', body: { status } });
