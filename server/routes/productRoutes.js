import { Router } from 'express';
import {
  getProducts,
  getCategories,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', getProducts);
router.get('/categories', getCategories); // must come before '/:slug'
router.get('/:slug', getProduct);

router.post('/', protect, authorize('admin'), createProduct);
router.patch('/:id', protect, authorize('admin'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);

export default router;
