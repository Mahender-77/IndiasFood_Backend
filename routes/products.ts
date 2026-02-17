import express from 'express';
import {
  getProducts,
  getProductById,
  getSweetsProducts,
  getPublicCategories,
  getSubcategoriesByCategory,
  getAllSubcategories,
  getGITaggedProducts,
  getNewArrivalProducts,
  getMostSoldProducts, // Added
} from '../controllers/productController';

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/categories', getPublicCategories);
router.get('/all-subcategories', getAllSubcategories);
router.get('/subcategories/:categoryName', getSubcategoriesByCategory);
router.get('/category/sweets', getSweetsProducts);
router.get('/gi-tagged', getGITaggedProducts);
router.get('/new-arrivals', getNewArrivalProducts);
router.get('/most-saled', getMostSoldProducts); // Added
router.get('/:id', getProductById);

export default router;