"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUengageWebhook = void 0;
const models_1 = require("../models");
const handleUengageWebhook = async (req, res) => {
    try {
        console.log('U-Engage webhook received:', JSON.stringify(req.body));
        const status_code = req.body?.status_code;
        const message = req.body?.message || '';
        const data = req.body?.data || {};
        const taskId = data.taskId;
        const orderIdToUse = data.vendor_order_id || data.orderId;
        // ❗ Always return 200 for webhooks
        if (!orderIdToUse) {
            console.error('Webhook missing vendor_order_id');
            return res.status(200).json({ status: true });
        }
        const order = await models_1.Order.findById(orderIdToUse);
        if (!order) {
            console.error('Order not found for webhook:', orderIdToUse);
            return res.status(200).json({ status: true });
        }
        /* ---------- STATUS MAP ---------- */
        const statusMap = {
            ACCEPTED: 'confirmed',
            ALLOTTED: 'out_for_delivery',
            ARRIVED: 'out_for_delivery',
            DISPATCHED: 'out_for_delivery',
            ARRIVED_CUSTOMER_DOORSTEP: 'out_for_delivery',
            DELIVERED: 'delivered',
            CANCELLED: 'cancelled',
            RTO_INIT: 'out_for_delivery',
            RTO_COMPLETE: 'delivered',
            SEARCHING_FOR_NEW_RIDER: 'confirmed'
        };
        /* ---------- UPDATE UENGAGE DATA ---------- */
        order.uengage = {
            ...order.uengage,
            taskId: taskId || order.uengage?.taskId,
            statusCode: status_code,
            message
        };
        if (statusMap[status_code]) {
            order.status = statusMap[status_code];
        }
        if (status_code === 'DELIVERED') {
            order.isDelivered = true;
            order.deliveredAt = new Date();
        }
        if (status_code === 'CANCELLED') {
            order.status = 'cancelled';
            order.cancelReason =
                order.cancelReason || message || 'Cancelled by delivery partner';
        }
        await order.save();
        console.log('Order updated via webhook:', order._id);
        return res.status(200).json({
            status: true,
            message: 'Webhook processed'
        });
    }
    catch (error) {
        console.error('Webhook error:', error);
        // ❗ STILL return 200
        return res.status(200).json({ status: true });
    }
};
exports.handleUengageWebhook = handleUengageWebhook;
