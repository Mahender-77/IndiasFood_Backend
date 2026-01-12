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
router.route('/orders').get(auth_1.protect, auth_1.admin, adminController_1.getAllOrders);
router.route('/orders/:id/status').put(auth_1.protect, auth_1.admin, adminController_1.updateOrderStatus);
router.route('/orders/:id/delivery').put(auth_1.protect, auth_1.admin, adminController_1.updateOrderToDelivered);
router.route('/orders/:id/assign-delivery').put(auth_1.protect, auth_1.admin, adminController_1.assignDeliveryPerson);
// Customer management
router.route('/customers').get(auth_1.protect, auth_1.admin, adminController_1.getCustomers);
router.route('/customers/:id').get(auth_1.protect, auth_1.admin, adminController_1.getCustomerById);
// Category management
router.route('/categories').get(auth_1.protect, auth_1.admin, adminController_1.getCategories).post(auth_1.protect, auth_1.admin, adminController_1.createCategory);
router.route('/categories/:id').put(auth_1.protect, auth_1.admin, adminController_1.updateCategory).delete(auth_1.protect, auth_1.admin, adminController_1.deleteCategory);
// Delivery Persons
router.route('/delivery-persons').get(auth_1.protect, auth_1.admin, adminController_1.getDeliveryPersons);
// Product management
router.route('/products').post(auth_1.protect, auth_1.admin, adminController_1.createProduct);
router.route('/products/:id').put(auth_1.protect, auth_1.admin, adminController_1.updateProduct); // New route for updating a product
router.route('/products/:id/images').post(auth_1.protect, auth_1.admin, multer_1.default.array('images', 5), adminController_1.uploadProductImages);
// Export data
router.route('/export/orders').get(auth_1.protect, auth_1.admin, adminController_1.exportOrders);
router.route('/export/customers').get(auth_1.protect, auth_1.admin, adminController_1.exportCustomers);
router.route('/export/products').get(auth_1.protect, auth_1.admin, adminController_1.exportProducts);
router.route('/export/sales').get(auth_1.protect, auth_1.admin, adminController_1.exportSales);
// Stats data
router.route('/stats/orders-count').get(auth_1.protect, auth_1.admin, adminController_1.getTotalOrdersCount);
router.route('/stats/customers-count').get(auth_1.protect, auth_1.admin, adminController_1.getTotalCustomersCount);
router.route('/stats/delivery-persons-count').get(auth_1.protect, auth_1.admin, adminController_1.getActiveDeliveryPersonsCount);
router.route('/stats/revenue-today').get(auth_1.protect, auth_1.admin, adminController_1.getRevenueToday);
exports.default = router;
