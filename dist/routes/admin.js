"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("../middleware/multer")); // Import Multer middleware
const adminController_1 = require("../controllers/adminController");
const router = express_1.default.Router();
// Order management
router.post('/orders/giveaway-eligibility-batch', auth_1.protect, auth_1.admin, adminController_1.getOrdersGiveAwayEligibilityBatch);
router.route('/orders').get(auth_1.protect, auth_1.admin, adminController_1.getAllOrders);
router.route('/orders/:id/delivery-status').put(auth_1.protect, auth_1.admin, adminController_1.adminUpdateOrderStatus);
router.route('/orders/:id/delivery').put(auth_1.protect, auth_1.admin, adminController_1.updateOrderToDelivered);
router.route('/orders/:id/assign-delivery').put(auth_1.protect, auth_1.admin, adminController_1.assignDeliveryPerson);
router.route('/orders/:id/invoice').get(auth_1.protect, auth_1.admin, adminController_1.getAdminInvoice);
router.route('/orders/:id/giveaway-eligibility').get(auth_1.protect, auth_1.admin, adminController_1.getOrderGiveAwayEligibility);
router.route('/orders/:id/apply-giveaway').post(auth_1.protect, auth_1.admin, adminController_1.applyGiveAwayToOrder);
// Customer management
router.route('/customers').get(auth_1.protect, auth_1.admin, adminController_1.getCustomers);
router.route('/customers/:id').get(auth_1.protect, auth_1.admin, adminController_1.getCustomerById);
// Category management
router.route('/categories').get(auth_1.protect, auth_1.admin, adminController_1.getCategories).post(auth_1.protect, auth_1.admin, adminController_1.createCategory);
router.route('/categories/:id').put(auth_1.protect, auth_1.admin, adminController_1.updateCategory).delete(auth_1.protect, auth_1.admin, adminController_1.deleteCategory);
// Delivery Persons
router.route('/delivery-persons').get(auth_1.protect, auth_1.admin, adminController_1.getDeliveryPersons);
// Delivery Settings
router.route('/delivery-settings').get(auth_1.protect, auth_1.admin, adminController_1.getDeliverySettings).put(auth_1.protect, auth_1.admin, adminController_1.updateDeliverySettings);
router.route('/delivery-locations').get(auth_1.protect, auth_1.admin, adminController_1.getDeliveryLocations);
// GiveAway management (explicit handlers — reliable with Express 5)
router.get('/giveaways', auth_1.protect, auth_1.admin, adminController_1.getGiveAways);
router.post('/giveaways', auth_1.protect, auth_1.admin, adminController_1.createGiveAway);
// More specific path before `/giveaways/:id`
router.get('/giveaways/:id/eligible-users', auth_1.protect, auth_1.admin, adminController_1.getGiveAwayEligibleUsers);
router.put('/giveaways/:id', auth_1.protect, auth_1.admin, adminController_1.updateGiveAway);
router.delete('/giveaways/:id', auth_1.protect, auth_1.admin, adminController_1.deleteGiveAway);
// Product management
router.route('/products').post(auth_1.protect, auth_1.admin, adminController_1.createProduct);
router.route('/products/:id').put(auth_1.protect, auth_1.admin, adminController_1.updateProduct); // New route for updating a product
router.route('/products/:id/images').post(auth_1.protect, auth_1.admin, multer_1.default.array('images', 5), adminController_1.uploadProductImages);
// Export data
router.route('/export/orders').get(auth_1.protect, auth_1.admin, adminController_1.exportOrders);
router.route('/export/customers').get(auth_1.protect, auth_1.admin, adminController_1.exportCustomers);
router.route('/export/products').get(auth_1.protect, auth_1.admin, adminController_1.exportProducts);
router.route('/export/sales').get(auth_1.protect, auth_1.admin, adminController_1.exportSales);
// Time-based exports
router.route('/export/orders/:period').get(auth_1.protect, auth_1.admin, adminController_1.exportOrdersByTime);
router.route('/export/sales/:period').get(auth_1.protect, auth_1.admin, adminController_1.exportSalesByTime);
// Stats data
router.route('/stats/orders-count').get(auth_1.protect, auth_1.admin, adminController_1.getTotalOrdersCount);
router.route('/stats/customers-count').get(auth_1.protect, auth_1.admin, adminController_1.getTotalCustomersCount);
router.route('/stats/delivery-persons-count').get(auth_1.protect, auth_1.admin, adminController_1.getActiveDeliveryPersonsCount);
router.route('/stats/revenue-today').get(auth_1.protect, auth_1.admin, adminController_1.getRevenueToday);
// Inventory management routes
// IMPORTANT: Specific routes MUST come before parameterized routes!
router.route('/inventory/create-product').post(auth_1.protect, auth_1.admin, adminController_1.createInventoryProduct);
router.route('/inventory/products/:id').put(auth_1.protect, auth_1.admin, adminController_1.updateInventoryProduct).delete(auth_1.protect, auth_1.admin, adminController_1.deactivateProduct);
router.route('/inventory').get(auth_1.protect, auth_1.admin, adminController_1.getAllProducts);
router.route('/inventory/:id/stock').put(auth_1.protect, auth_1.admin, adminController_1.updateStock);
router.route('/inventory/:id/batches').put(auth_1.protect, auth_1.admin, adminController_1.addBatches);
router.route('/inventory/:id/flag').put(auth_1.protect, auth_1.admin, adminController_1.toggleFlag);
router.route('/inventory/:id/most-saled').put(auth_1.protect, auth_1.admin, adminController_1.toggleMostSaled);
router.route('/inventory/:location').get(auth_1.protect, auth_1.admin, adminController_1.getInventory);
exports.default = router;
