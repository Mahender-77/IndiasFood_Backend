"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const userController_1 = require("../controllers/userController");
const router = express_1.default.Router();
// Cart routes
router.route('/cart').get(auth_1.protect, userController_1.getUserCart).post(auth_1.protect, userController_1.updateCart);
// Wishlist routes
router.route('/wishlist').get(auth_1.protect, userController_1.getUserWishlist).post(auth_1.protect, userController_1.toggleWishlist);
// Order routes
router.route('/checkout').post(auth_1.protect, userController_1.createOrder);
router.route('/orders').get(auth_1.protect, userController_1.getUserOrders);
router.route('/orders/:id').get(auth_1.protect, userController_1.getOrderById);
exports.default = router;
