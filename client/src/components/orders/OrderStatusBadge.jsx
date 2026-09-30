import { STATUS_INFO, needsRefund } from '../../utils/orders.js';

export default function OrderStatusBadge({ order }) {
  const info = needsRefund(order)
    ? { label: 'Cancelled · refund due', className: 'bg-red-100 text-red-800' }
    : (STATUS_INFO[order.status] ?? { label: order.status, className: 'bg-slate-100 text-slate-700' });

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${info.className}`}>
      {info.label}
    </span>
  );
}
