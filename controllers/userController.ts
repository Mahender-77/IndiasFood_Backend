import { Request, Response } from 'express';
import axios from 'axios';
import User from '../models/User';
import Product from '../models/Product';
import Order from '../models/Order';
import DeliverySettings from '../models/DeliverySettings';

interface AuthenticatedRequest extends Request {
  user?: any;
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
  try {
    const { productId, qty, selectedVariantIndex = 0 } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Not authorized, user ID missing' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Find item index considering both productId and selectedVariantIndex
    const itemIndex = user.cart.findIndex(
      (item: any) => {
        const itemProductId = item.product._id ? item.product._id.toString() : item.product.toString();
        const itemVariantIndex = item.selectedVariantIndex !== undefined ? item.selectedVariantIndex : 0;
        return itemProductId === productId && itemVariantIndex === selectedVariantIndex;
      }
    );

    if (itemIndex > -1) {
      // Update quantity or remove item
      if (qty > 0) {
        user.cart[itemIndex].qty = qty;
        user.cart[itemIndex].selectedVariantIndex = selectedVariantIndex;
      } else {
        user.cart.splice(itemIndex, 1);
      }
    } else if (qty > 0) {
      // Add new item with variant index
      user.cart.push({ 
        product: productId as any, 
        qty, 
        selectedVariantIndex 
      });
    } else {
      // If trying to remove item that doesn't exist, just return current cart
      await user.populate('cart.product');
      return res.json(user.cart);
    }

    await user.save();
    await user.populate('cart.product');
    
    res.json(user.cart);
  } catch (error: any) {
    console.error('Error in updateCart:', error);
    res.status(500).json({ 
      message: 'Error updating cart', 
      error: error.message 
    });
  }
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
  try {
    const {
      orderItems,
      shippingAddress,
      paymentMethod,
      taxPrice,
      shippingPrice,
      totalPrice,
      distance
    } = req.body;

    console.log('Create order request:', {
      userId: req.user._id,
      orderItemsCount: orderItems?.length,
      shippingAddress,
      paymentMethod,
      totalPrice,
      distance
    });

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    }

    // Validate required fields
    if (!shippingAddress || !paymentMethod) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate shipping address required fields
    if (!shippingAddress.address || !shippingAddress.city || !shippingAddress.postalCode) {
      return res.status(400).json({ message: 'Incomplete shipping address' });
    }

    console.log('Creating order with data:', {
      user: req.user._id,
      orderItems: orderItems.length,
      shippingAddress,
      paymentMethod,
      totalPrice
    });

    const order = new Order({
      user: req.user._id,
      orderItems,
      shippingAddress,
      paymentMethod,
      taxPrice: taxPrice || 0,
      shippingPrice: shippingPrice || 0,
      totalPrice,
      distance: distance || 0,
      status: 'placed',
    });

    console.log('Order object created, saving...');
    const createdOrder = await order.save();
    console.log('Order saved successfully:', createdOrder._id);

    // Clear the user's cart after successful checkout
    const user = await User.findById(req.user._id);
    if (user) {
      user.cart.splice(0, user.cart.length);
      await user.save();
      console.log('User cart cleared');
    }

    res.status(201).json(createdOrder);
  } catch (error: any) {
    console.error('Error creating order:', error);
    res.status(500).json({
      message: 'Error creating order',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/user/orders
// @access  Private
export const getUserOrders = async (req: AuthenticatedRequest, res: Response) => {
  const orders = await Order.find({ user: req.user._id })
    .populate('user', 'username email')
    .sort({ createdAt: -1 });
  res.json(orders);
};

// @desc    Get order by ID
// @route   GET /api/user/orders/:id
// @access  Private
export const getOrderById = async (req: AuthenticatedRequest, res: Response) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  // Check if order belongs to the authenticated user
  const orderUserId = (order.user as any).id ? (order.user as any).id.toString() : (order.user as any).toString();
  if (order && orderUserId === req.user._id.toString()) {
    res.json(order);
  } else {
    res.status(404).json({ message: 'Order not found' });
  }
};

// @desc    Cancel order
// @route   PUT /api/user/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Cancellation reason is required' });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order belongs to the user
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to cancel this order' });
    }

    // Check if order can be cancelled
    if (order.isDelivered) {
      return res.status(400).json({ message: 'Cannot cancel delivered order' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Order is already cancelled' });
    }

    if (order.status === 'out_for_delivery') {
      return res.status(400).json({ message: 'Cannot cancel order that is out for delivery' });
    }

    order.status = 'cancelled';
    order.cancelReason = reason;
    order.cancelledAt = new Date();

    await order.save();

    res.json({ 
      message: 'Order cancelled successfully', 
      order 
    });
  } catch (error: any) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ message: 'Failed to cancel order' });
  }
};





// GET DELIVERY SETTINGS (ALL DATA)
export const getDeliverySettings = async (req: Request, res: Response) => {
  try {
    const settings = await DeliverySettings.findOne();

    if (!settings) {
      return res.status(404).json({
        message: 'Delivery settings not found'
      });
    }

    res.json({
      pricePerKm: settings.pricePerKm,
      baseCharge: settings.baseCharge,
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
      storeLocations: settings.storeLocations
    });

  } catch (error) {
    res.status(500).json({
      message: 'Server error'
    });
  }
};

// @desc    Geocode address to coordinates
// @route   GET /api/user/geocode
// @access  Public
export const geocodeAddress = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ message: "Address query is required" });
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "YourAppName/1.0 (support@yourdomain.com)"
      }
    });

    console.log("NOMINATIM STATUS:", response.status);

    const text = await response.text();
    console.log("NOMINATIM RAW RESPONSE:", text);

    if (!response.ok) {
      return res.status(response.status).json({
        message: "Geocoding service failed",
        raw: text
      });
    }

    const data = JSON.parse(text);

    if (!data || !data.length) {
      return res.status(404).json({ message: "Address not found" });
    }

    res.json({
      latitude: Number(data[0].lat),
      longitude: Number(data[0].lon)
    });

  } catch (error) {
    console.error("GEOCODE ERROR:", error);
    res.status(500).json({ message: "Internal geocoding error" });
  }
};


// @desc    Reverse geocode coordinates to address
// @route   GET /api/user/reverse-geocode
// @access  Public
export const reverseGeocode = async (req: Request, res: Response) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ message: "lat and lon required" });
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "YourAppName/1.0 (support@yourdomain.com)"
      }
    });

    console.log("REVERSE NOMINATIM STATUS:", response.status);

    const text = await response.text();
    console.log("REVERSE NOMINATIM RAW:", text);

    if (!response.ok) {
      return res.status(response.status).json({
        message: "Reverse geocode failed",
        raw: text
      });
    }

    const data = JSON.parse(text);
    const addr = data.address || {};

    res.json({
      address:
        addr.road ||
        addr.suburb ||
        addr.neighbourhood ||
        "",
      city: addr.city || addr.town || addr.village || "",
      postalCode: addr.postcode || "",
      locationName: data.display_name || ""
    });

  } catch (err) {
    console.error("REVERSE GEOCODE ERROR:", err);
    res.status(500).json({ message: "Reverse geocoding error" });
  }
};



export const checkAvailability = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pickup, drop } = req.body;
    console.log("from check availability",pickup, drop);

    const response = await axios.post(
      process.env.UENGAGE_BASE + "/getServiceability",
      {
        store_id: process.env.STORE_ID,
        pickupDetails: pickup,
        dropDetails: drop
      },
      {
        headers: {
          "access-token": process.env.UENGAGE_TOKEN,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);

  } catch (err) {
    console.log(err.response?.data || err.message);
    res.status(500).json({ error: "Serviceability failed" });
  }

};

// @desc    Subscribe to newsletter
// @route   POST /api/user/newsletter/subscribe
// @access  Public (can be used by non-logged-in users)
export const subscribeNewsletter = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    // Check if user exists with this email
    const user = await User.findOne({ email });

    if (user) {
      // Update existing user's newsletter subscription
      user.newsletterSubscribed = true;
      await user.save();
      res.json({ message: 'Successfully subscribed to newsletter' });
    } else {
      // For non-registered users, we could create a newsletter subscriber record
      // For now, we'll just return success since this is a simple implementation
      res.json({ message: 'Successfully subscribed to newsletter' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};