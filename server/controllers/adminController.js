import Product from '../models/Product.js';
import Order from '../models/Order.js';

// Same threshold the storefront uses for its "Only N left" warning
export const LOW_STOCK_THRESHOLD = 5;
const LOW_STOCK_LIST_LIMIT = 10;

// GET /api/admin/stats   (admin only)
// Every number is counted from the database; nothing is estimated or cached.
export const getStats = async (req, res) => {
  const lowStockFilter = { stock: { $lte: LOW_STOCK_THRESHOLD } };

  const [totalProducts, lowStockCount, lowStockProducts, totalOrders, pendingOrders, awaitingPayment] =
    await Promise.all([
      Product.countDocuments(),
      Product.countDocuments(lowStockFilter),
      Product.find(lowStockFilter)
        .sort({ stock: 1, name: 1 })
        .limit(LOW_STOCK_LIST_LIMIT)
        .select('name slug stock price images category'),
      Order.countDocuments(),
      // Placed and confirmed (paid online, or cash on delivery) but not shipped yet
      Order.countDocuments({ status: 'confirmed' }),
      // Online orders still waiting for payment (auto-cancelled after 30 minutes)
      Order.countDocuments({ status: 'awaiting_payment' }),
    ]);

  res.json({
    success: true,
    stats: {
      totalProducts,
      totalOrders,
      pendingOrders,
      awaitingPayment,
      lowStock: {
        threshold: LOW_STOCK_THRESHOLD,
        count: lowStockCount,
        products: lowStockProducts,
      },
    },
  });
};
