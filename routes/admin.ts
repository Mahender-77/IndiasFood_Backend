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
  toggleFlag,
  // getAllInventoryProducts,
  deactivateProduct,
  getAllProducts,
  getDeliverySettings,
  updateDeliverySettings,
  getDeliveryLocations,
  exportOrdersByTime,
  exportSalesByTime,
  adminUpdateOrderStatus,
} from '../controllers/adminController';

const router = express.Router();

// Order management
router.route('/orders').get(protect, admin, getAllOrders);
router.route('/orders/:id/delivery-status').put(protect, admin, adminUpdateOrderStatus);
router.route('/orders/:id/delivery').put(protect, admin, updateOrderToDelivered);
router.route('/orders/:id/assign-delivery').put(protect, admin, assignDeliveryPerson);

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
router.route('/inventory/:id/flag').put(protect, admin, toggleFlag);
router.route('/inventory/:location').get(protect, admin, getInventory);



export default router;
