import express, { Request, Response, NextFunction } from 'express';
import { protect, admin, delivery } from '../middleware/auth';
import { applyForDelivery, getPendingApplications, approveDeliveryApplication } from '../controllers/deliveryController';
import { getMyAssignedOrders, markOrderAsDelivered } from '../controllers/orderDeliveryController';

const router = express.Router();

router.route('/apply').post(protect, applyForDelivery);
router.route('/applications').get(protect, admin, getPendingApplications);
router.route('/:id/approve').put(protect, admin, approveDeliveryApplication);
router.route('/orders').get(protect, delivery, getMyAssignedOrders as any);
router.route('/orders/:id/deliver').put(protect, delivery, markOrderAsDelivered as any);

export default router;

