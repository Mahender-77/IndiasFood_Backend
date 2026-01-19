import { Request, Response } from 'express';
import Order from '../models/Order';
import User from '../models/User';

interface AuthenticatedRequest extends Request {
  user?: any; // You might want to define a more specific User type
}

// @desc    Assign an order to a delivery person
// @route   PUT /api/admin/orders/:id/assign-delivery
// @access  Private/Admin
export const assignOrderToDeliveryPerson = async (req: Request, res: Response) => {
  const { orderId } = req.params; // Corrected to orderId
  const { deliveryPersonId, eta } = req.body;

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const deliveryPerson = await User.findById(deliveryPersonId);

    if (!deliveryPerson || deliveryPerson.role !== 'delivery') {
      return res.status(404).json({ message: 'Delivery person not found or not a delivery role' });
    }

    order.deliveryPerson = deliveryPersonId;
    order.eta = eta;
    order.status = 'confirmed';

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all orders assigned to the logged-in delivery person
// @route   GET /api/delivery/orders
// @access  Private/Delivery
export const getMyAssignedOrders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = await Order.find({ deliveryPerson: req.user._id })
      .populate('user', 'username email phone')
      .populate('orderItems.product', 'name');
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark order as delivered
// @route   PUT /api/delivery/orders/:id/deliver
// @access  Private/Delivery
export const markOrderAsDelivered = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);

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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
