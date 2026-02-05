"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markOrderAsDelivered = exports.getMyAssignedOrders = exports.assignOrderToDeliveryPerson = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const User_1 = __importDefault(require("../models/User"));
// @desc    Assign an order to a delivery person
// @route   PUT /api/admin/orders/:id/assign-delivery
// @access  Private/Admin
const assignOrderToDeliveryPerson = async (req, res) => {
    const { orderId } = req.params; // Corrected to orderId
    const { deliveryPersonId, eta } = req.body;
    try {
        const order = await Order_1.default.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        const deliveryPerson = await User_1.default.findById(deliveryPersonId);
        if (!deliveryPerson || deliveryPerson.role !== 'delivery') {
            return res.status(404).json({ message: 'Delivery person not found or not a delivery role' });
        }
        order.deliveryPerson = deliveryPersonId;
        order.eta = eta;
        order.status = 'confirmed';
        const updatedOrder = await order.save();
        res.json(updatedOrder);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.assignOrderToDeliveryPerson = assignOrderToDeliveryPerson;
// @desc    Get all orders assigned to the logged-in delivery person
// @route   GET /api/delivery/orders
// @access  Private/Delivery
const getMyAssignedOrders = async (req, res) => {
    try {
        const orders = await Order_1.default.find({ deliveryPerson: req.user._id })
            .populate('user', 'username email phone')
            .populate('orderItems.product', 'name');
        res.json(orders);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getMyAssignedOrders = getMyAssignedOrders;
// @desc    Mark order as delivered
// @route   PUT /api/delivery/orders/:id/deliver
// @access  Private/Delivery
const markOrderAsDelivered = async (req, res) => {
    try {
        const order = await Order_1.default.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.deliveryPerson.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized to deliver this order' });
        }
        order.isDelivered = true;
        order.deliveredAt = new Date();
        order.status = 'delivered';
        const updatedOrder = await order.save();
        res.json(updatedOrder);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.markOrderAsDelivered = markOrderAsDelivered;
