import { Router } from 'express';
import { updateMyReview, deleteMyReview } from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';

// A customer's own review (creating one lives under /api/products/:slug/reviews)
const router = Router();

router.use(protect);

router.patch('/:id', updateMyReview);
router.delete('/:id', deleteMyReview);

export default router;
