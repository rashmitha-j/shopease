import Order from '../models/Order.js';

// Online orders reserve stock when placed. If they are not paid within this time,
// they are cancelled and the stock goes back on sale.
export const PAYMENT_WINDOW_MINUTES = 30;
const CHECK_EVERY_MS = 5 * 60 * 1000;

export async function releaseExpiredOrders(now = new Date()) {
  const cutoff = new Date(now.getTime() - PAYMENT_WINDOW_MINUTES * 60 * 1000);
  const expired = await Order.find({ status: 'awaiting_payment', createdAt: { $lt: cutoff } }).select('_id');

  let released = 0;
  for (const { _id } of expired) {
    // cancelUnpaid re-checks the status, so an order paid in the meantime is left alone
    if (await Order.cancelUnpaid({ _id }, 'Payment not completed in time')) released++;
  }
  return released;
}

export function startExpiredOrderJob() {
  const run = () =>
    releaseExpiredOrders()
      .then((count) => count && console.log(`Released stock from ${count} expired unpaid order(s)`))
      .catch((err) => console.error('Expired order cleanup failed:', err.message));

  run();
  // unref() lets the process exit normally (e.g. in scripts) even though the timer is running
  return setInterval(run, CHECK_EVERY_MS).unref();
}
