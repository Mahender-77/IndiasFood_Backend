"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productController_1 = require("../controllers/productController");
const router = express_1.default.Router();
// Public routes
router.get('/', productController_1.getProducts);
router.get('/categories', productController_1.getPublicCategories);
router.get('/all-subcategories', productController_1.getAllSubcategories);
router.get('/subcategories/:categoryName', productController_1.getSubcategoriesByCategory);
router.get('/category/sweets', productController_1.getSweetsProducts);
router.get('/gi-tagged', productController_1.getGITaggedProducts);
router.get('/new-arrivals', productController_1.getNewArrivalProducts);
router.get('/:id', productController_1.getProductById);
exports.default = router;
