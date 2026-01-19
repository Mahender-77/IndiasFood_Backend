import express from 'express';
import { 
  getProducts, 
  getProductById, 
  getSweetsProducts, 
  getPublicCategories,
  getGITaggedProducts,
  getNewArrivalProducts 
} from '../controllers/productController';

const router = express.Router();

router.get('/', getProducts);
router.get('/category/sweets', getSweetsProducts);
router.get('/categories', getPublicCategories);
router.get('/gi-tagged', getGITaggedProducts);
router.get('/new-arrivals', getNewArrivalProducts);
router.get('/:id', getProductById);

export default router;