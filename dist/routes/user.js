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
router.route('/cart/merge').post(auth_1.protect, userController_1.mergeCart);
// Wishlist routes
router.route('/wishlist').get(auth_1.protect, userController_1.getUserWishlist).post(auth_1.protect, userController_1.toggleWishlist);
//Address
router.route('/addresses').get(auth_1.protect, userController_1.getSavedAddress);
router.route('/addresses').post(auth_1.protect, userController_1.addNewAddress);
router.route('/addresses/:addressId').put(auth_1.protect, userController_1.UpdateAddress);
router.route('/addresses/:addressId').delete(auth_1.protect, userController_1.deleteAddress);
router.route('/addresses/:addressId/set-default').put(auth_1.protect, userController_1.defaultAddress);
// Order routes
router.route('/checkout').post(auth_1.protect, userController_1.createOrder);
router.route('/orders').get(auth_1.protect, userController_1.getUserOrders);
router.route('/orders/:id').get(auth_1.protect, userController_1.getOrderById);
router.route('/orders/:id/cancel').put(auth_1.protect, userController_1.cancelOrder);
router.route('/orders/:id/track').get(auth_1.protect, userController_1.trackOrderStatus);
// Store locations
router.route('/delivery-settings').get(userController_1.getDeliverySettings);
// Geocoding routes
router.route('/search-location').get(userController_1.searchLocation);
router.route('/reverse-geocode').get(userController_1.reverseGeocode);
router.route('/geocode-address').get(userController_1.geocodeAddress);
// Get user UEngage
router.route('/check-availability').post(userController_1.checkAvailability);
// Newsletter subscription
router.route('/newsletter/subscribe').post(userController_1.subscribeNewsletter);
exports.default = router;
