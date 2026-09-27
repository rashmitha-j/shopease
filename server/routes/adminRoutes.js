import { Router } from 'express';
import { getStats } from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize('admin')); // every admin route needs a logged-in admin

router.get('/stats', getStats);

export default router;
