import express from 'express';
import { getProducts, getProductById, getSweetsProducts, getPublicCategories } from '../controllers/productController';

const router = express.Router();

router.get('/', getProducts);
router.get('/category/sweets', getSweetsProducts);
router.get('/categories', getPublicCategories); // New public route for categories
router.get('/:id', getProductById);

export default router;