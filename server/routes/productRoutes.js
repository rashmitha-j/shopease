import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getProducts,
  getCategories,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js';
import { listProductReviews, getMyReviewStatus, createReview } from '../controllers/reviewController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', getProducts);
router.get('/categories', getCategories); // must come before '/:slug'
router.get('/:slug', getProduct);

// Reviews for a product
const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many reviews, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});
router.get('/:slug/reviews', listProductReviews);
router.get('/:slug/reviews/me', protect, getMyReviewStatus);
router.post('/:slug/reviews', protect, reviewLimiter, createReview);

router.post('/', protect, authorize('admin'), createProduct);
router.patch('/:id', protect, authorize('admin'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);

export default router;
