import express, { Request, Response } from 'express';
import { protect } from '../middleware/auth';
import {
  getUserCart,
  updateCart,
  getUserWishlist,
  toggleWishlist,
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  getDeliverySettings,
  geocodeAddress,
  reverseGeocode,
  checkAvailability,
  subscribeNewsletter,
  searchLocation,
  trackOrderStatus,
  // handleUengageWebhook,
} from '../controllers/userController';


const router = express.Router();


// Cart routes
router.route('/cart').get(protect, getUserCart).post(protect, updateCart);

// Wishlist routes
router.route('/wishlist').get(protect, getUserWishlist).post(protect, toggleWishlist);



// Order routes
router.route('/checkout').post(protect, createOrder);
router.route('/orders').get(protect, getUserOrders);
router.route('/orders/:id').get(protect, getOrderById);
router.route('/orders/:id/cancel').put(protect, cancelOrder);
router.route('/orders/:id/track').get(protect, trackOrderStatus);


// Store locations

router.route('/delivery-settings').get(getDeliverySettings);

// Geocoding routes
router.route('/search-location').get(searchLocation);
router.route('/reverse-geocode').get(reverseGeocode);
router.route('/geocode-address').get(geocodeAddress)

// Get user UEngage
router.route('/check-availability').post(checkAvailability);

// Newsletter subscription
router.route('/newsletter/subscribe').post(subscribeNewsletter);



export default router;
