import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createOrder,
  verifyPayment,
  cancelOrder,
  getMyOrders,
  getOrder,
} from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Each order reserves stock, so limit how quickly orders can be created
const createOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many orders, please try again later' },
  skip: () => process.env.NODE_ENV === 'test', // the test suite places many orders from one IP
});

router.use(protect); // every order route needs a logged-in user

router.post('/', createOrderLimiter, createOrder);
router.get('/mine', getMyOrders); // must come before '/:id'
router.get('/:id', getOrder);
router.post('/:id/verify-payment', verifyPayment);
router.post('/:id/cancel', cancelOrder);

export default router;
