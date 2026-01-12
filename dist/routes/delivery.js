"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const deliveryController_1 = require("../controllers/deliveryController");
const orderDeliveryController_1 = require("../controllers/orderDeliveryController");
const router = express_1.default.Router();
router.route('/apply').post(auth_1.protect, deliveryController_1.applyForDelivery);
router.route('/applications').get(auth_1.protect, auth_1.admin, deliveryController_1.getPendingApplications);
router.route('/:id/approve').put(auth_1.protect, auth_1.admin, deliveryController_1.approveDeliveryApplication);
router.route('/orders').get(auth_1.protect, auth_1.delivery, orderDeliveryController_1.getMyAssignedOrders);
router.route('/orders/:id/deliver').put(auth_1.protect, auth_1.delivery, orderDeliveryController_1.markOrderAsDelivered);
exports.default = router;
