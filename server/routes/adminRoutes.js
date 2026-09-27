import { Router } from 'express';
import { getStats } from '../controllers/adminController.js';
import { listOrders, getOrderForAdmin, updateOrderStatus } from '../controllers/adminOrderController.js';
import { listReviews, moderateReview, deleteReview } from '../controllers/adminReviewController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize('admin')); // every admin route needs a logged-in admin

router.get('/stats', getStats);

router.get('/orders', listOrders);
router.get('/orders/:id', getOrderForAdmin);
router.patch('/orders/:id/status', updateOrderStatus);

router.get('/reviews', listReviews);
router.patch('/reviews/:id', moderateReview);
router.delete('/reviews/:id', deleteReview);

export default router;
