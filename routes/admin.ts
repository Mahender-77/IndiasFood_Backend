import express from 'express';
import { protect, admin } from '../middleware/auth';
import upload from '../middleware/multer'; // Import Multer middleware

import {
  getAllOrders,
  updateOrderToDelivered,
  assignDeliveryPerson,
  createProduct,
  updateProduct, // Import updateProduct
  uploadProductImages,
  exportOrders,
  getDeliveryPersons,
  getCustomers,
  getCustomerById,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  exportCustomers,
  exportProducts,
  exportSales,
  getTotalOrdersCount,
  getTotalCustomersCount,
  getActiveDeliveryPersonsCount,
  getRevenueToday,
  // getLocations,
  // createLocation,
  // updateLocation,
  // deleteLocation,
  // Inventory functions
  getInventory,
  createInventoryProduct,
  updateInventoryProduct,
  updateStock,
  addBatches,
  toggleFlag,
  toggleMostSaled,
  // getAllInventoryProducts,
  deactivateProduct,
  getAllProducts,
  getDeliverySettings,
  updateDeliverySettings,
  getDeliveryLocations,
  exportOrdersByTime,
  exportSalesByTime,
  adminUpdateOrderStatus,
  getAdminInvoice,
  getGiveAways,
  createGiveAway,
  updateGiveAway,
  deleteGiveAway,
  getOrderGiveAwayEligibility,
  getOrdersGiveAwayEligibilityBatch,
  applyGiveAwayToOrder,
  getGiveAwayEligibleUsers,
  
} from '../controllers/adminController';

const router = express.Router();

// Order management
router.post('/orders/giveaway-eligibility-batch', protect, admin, getOrdersGiveAwayEligibilityBatch);
router.route('/orders').get(protect, admin, getAllOrders);
router.route('/orders/:id/delivery-status').put(protect, admin, adminUpdateOrderStatus);
router.route('/orders/:id/delivery').put(protect, admin, updateOrderToDelivered);
router.route('/orders/:id/assign-delivery').put(protect, admin, assignDeliveryPerson);
router.route('/orders/:id/invoice').get(protect, admin, getAdminInvoice);
router.route('/orders/:id/giveaway-eligibility').get(protect, admin, getOrderGiveAwayEligibility);
router.route('/orders/:id/apply-giveaway').post(protect, admin, applyGiveAwayToOrder);

// Customer management
router.route('/customers').get(protect, admin, getCustomers);
router.route('/customers/:id').get(protect, admin, getCustomerById);

// Category management
router.route('/categories').get(protect, admin, getCategories).post(protect, admin, createCategory);
router.route('/categories/:id').put(protect, admin, updateCategory).delete(protect, admin, deleteCategory);

// Delivery Persons
router.route('/delivery-persons').get(protect, admin, getDeliveryPersons);

// Delivery Settings
router.route('/delivery-settings').get(protect, admin, getDeliverySettings).put(protect, admin, updateDeliverySettings);
router.route('/delivery-locations').get(protect, admin, getDeliveryLocations);

// GiveAway management (explicit handlers — reliable with Express 5)
router.get('/giveaways', protect, admin, getGiveAways);
router.post('/giveaways', protect, admin, createGiveAway);
// More specific path before `/giveaways/:id`
router.get('/giveaways/:id/eligible-users', protect, admin, getGiveAwayEligibleUsers);
router.put('/giveaways/:id', protect, admin, updateGiveAway);
router.delete('/giveaways/:id', protect, admin, deleteGiveAway);

// Product management
router.route('/products').post(protect, admin, createProduct);
router.route('/products/:id').put(protect, admin, updateProduct); // New route for updating a product
router.route('/products/:id/images').post(protect, admin, upload.array('images', 5), uploadProductImages);

// Export data
router.route('/export/orders').get(protect, admin, exportOrders);
router.route('/export/customers').get(protect, admin, exportCustomers);
router.route('/export/products').get(protect, admin, exportProducts);
router.route('/export/sales').get(protect, admin, exportSales);

// Time-based exports
router.route('/export/orders/:period').get(protect, admin, exportOrdersByTime);
router.route('/export/sales/:period').get(protect, admin, exportSalesByTime);

// Stats data
router.route('/stats/orders-count').get(protect, admin, getTotalOrdersCount);
router.route('/stats/customers-count').get(protect, admin, getTotalCustomersCount);
router.route('/stats/delivery-persons-count').get(protect, admin, getActiveDeliveryPersonsCount);
router.route('/stats/revenue-today').get(protect, admin, getRevenueToday);

// Inventory management routes
// IMPORTANT: Specific routes MUST come before parameterized routes!
router.route('/inventory/create-product').post(protect, admin, createInventoryProduct);
router.route('/inventory/products/:id').put(protect, admin, updateInventoryProduct).delete(protect, admin, deactivateProduct);
router.route('/inventory').get(protect, admin, getAllProducts);
router.route('/inventory/:id/stock').put(protect, admin, updateStock);
router.route('/inventory/:id/batches').put(protect, admin, addBatches);
router.route('/inventory/:id/flag').put(protect, admin, toggleFlag);
router.route('/inventory/:id/most-saled').put(protect, admin, toggleMostSaled);
router.route('/inventory/:location').get(protect, admin, getInventory);



export default router;
