import { Request, Response } from 'express';
import User from '../models/User';
import Product from '../models/Product';
import Order from '../models/Order';

interface AuthenticatedRequest extends Request {
  user?: any; // You might want to define a more specific User type
}

// @desc    Get user cart
// @route   GET /api/user/cart
// @access  Private
export const getUserCart = async (req: AuthenticatedRequest, res: Response) => {
  const user = await User.findById(req.user._id).populate('cart.product');
  if (user) {
    res.json(user.cart);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Add/update/remove item from cart
// @route   POST /api/user/cart
// @access  Private
export const updateCart = async (req: AuthenticatedRequest, res: Response) => {
  const { productId, qty } = req.body;

  console.log('Received cart update request:', { productId, qty, userId: req.user?._id });

  if (!req.user || !req.user._id) {
    console.error('User not authenticated or user ID missing in updateCart');
    return res.status(401).json({ message: 'Not authorized, user ID missing' });
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    console.error('User not found in DB for ID:', req.user._id);
    return res.status(404).json({ message: 'User not found' });
  }
  console.log('Found user:', user.email);

  const product = await Product.findById(productId);

  if (!product) {
    console.error('Product not found for ID:', productId);
    return res.status(404).json({ message: 'Product not found' });
  }
  console.log('Found product:', product.name);

  const itemIndex = user.cart.findIndex(
    (item: any) => item.product.toString() === productId
  );

  if (itemIndex > -1) {
    // Update quantity or remove item
    if (qty > 0) {
      user.cart[itemIndex].qty = qty;
      console.log('Updated quantity for existing item:', productId, 'to', qty);
    } else {
      user.cart.splice(itemIndex, 1);
      console.log('Removed item from cart:', productId);
    }
  } else if (qty > 0) {
    // Add new item
    user.cart.push({ product: productId, qty });
    console.log('Added new item to cart:', productId, 'with quantity', qty);
  } else {
    // If qty is 0 or less and item not in cart, do nothing or send a specific response
    console.log('Attempted to add/update item with qty <= 0 when not in cart or itemIndex invalid.');
    return res.status(400).json({ message: 'Invalid quantity or product not in cart to remove' });
  }

  await user.save();
  // Populate cart products before sending back
  await user.populate('cart.product');
  console.log('Cart updated and saved successfully for user:', user.email);
  res.json(user.cart);
};

// @desc    Get user wishlist
// @route   GET /api/user/wishlist
// @access  Private
export const getUserWishlist = async (req: AuthenticatedRequest, res: Response) => {
  const user = await User.findById(req.user._id).populate('wishlist');
  if (user) {
    res.json(user.wishlist);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Toggle product in wishlist
// @route   POST /api/user/wishlist
// @access  Private
export const toggleWishlist = async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.body;

  const user = await User.findById(req.user._id);

  if (user) {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const itemIndex = user.wishlist.findIndex(
      (item: any) => item.toString() === productId
    );

    if (itemIndex > -1) {
      user.wishlist.splice(itemIndex, 1);
    } else {
      user.wishlist.push(productId);
    }

    await user.save();
    res.json(user.wishlist);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Create new order
// @route   POST /api/user/checkout
// @access  Private
export const createOrder = async (req: AuthenticatedRequest, res: Response) => {
  const { orderItems, shippingAddress, paymentMethod, taxPrice, shippingPrice, totalPrice } = req.body;

  if (orderItems && orderItems.length === 0) {
    res.status(400).json({ message: 'No order items' });
    return;
  }

  const order = new Order({
    user: req.user._id,
    orderItems,
    shippingAddress,
    paymentMethod,
    taxPrice,
    shippingPrice,
    totalPrice,
  });

  const createdOrder = await order.save();
  // Clear the user's cart after successful checkout
  const user = await User.findById(req.user._id);
  if (user) {
    user.cart.splice(0, user.cart.length); // Fix: Use splice to clear the DocumentArray
    await user.save();
  }

  res.status(201).json(createdOrder);
};

// @desc    Get logged in user orders
// @route   GET /api/user/orders
// @access  Private
export const getUserOrders = async (req: AuthenticatedRequest, res: Response) => {
  const orders = await Order.find({ user: req.user._id }).populate('user', 'username email');
  res.json(orders);
};

// @desc    Get order by ID
// @route   GET /api/user/orders/:id
// @access  Private
export const getOrderById = async (req: AuthenticatedRequest, res: Response) => {
  const order = await Order.findById(req.params.id).populate('user', 'username email');

  if (order && order.user._id.toString() === req.user._id.toString()) {
    res.json(order);
  } else {
    res.status(404).json({ message: 'Order not found' });
  }
};