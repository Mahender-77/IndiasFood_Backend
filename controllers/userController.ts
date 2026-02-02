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
      totalPrice
    } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    }

    if (!shippingAddress || !paymentMethod) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!shippingAddress.address || !shippingAddress.city || !shippingAddress.postalCode) {
      return res.status(400).json({ message: 'Incomplete shipping address' });
    }

    /* ---------------- 1️⃣ GET STORE FROM PRODUCT ---------------- */

    // Assumption: one order = one store
    const firstItem = orderItems[0];

    const product = await Product.findById(firstItem.product).select('store');
    if (!product) {
      return res.status(400).json({ message: 'Product not found' });
    }

    const storeId = product.store;

    /* ---------------- 2️⃣ GET STORE DETAILS FROM DELIVERY SETTINGS ---------------- */

    const deliverySettings = await DeliverySettings.findOne({
      storeLocations: {
        $elemMatch: {
          storeId,
          isActive: true
        }
      }
    });

    if (!deliverySettings) {
      return res.status(400).json({ message: 'Store not found or inactive' });
    }

    const store = deliverySettings.storeLocations.find(
      (s: any) => s.storeId.toString() === storeId.toString()
    );

    if (!store) {
      return res.status(400).json({ message: 'Store location not found' });
    }

    /* ---------------- 3️⃣ CREATE ORDER ---------------- */

    const order = new Order({
      user: req.user._id,
      orderItems,
      shippingAddress,
      paymentMethod,
      taxPrice: taxPrice || 0,
      shippingPrice: shippingPrice || 0,
      totalPrice,
      status: 'placed'
    });

    const createdOrder = await order.save();

    /* ---------------- 4️⃣ CALL U-ENGAGE CREATE TASK ---------------- */

    const uengagePayload = {
      storeId: process.env.STORE_ID,

      order_details: {
        order_total: totalPrice,
        paid: paymentMethod !== 'Cash On Delivery',
        vendor_order_id: createdOrder._id.toString(),
        order_source: 'web'
      },

      pickup_details: {
        name: store.name,
        contact_number: store.contact_number,
        latitude: store.latitude,
        longitude: store.longitude,
        address: store.address,
        city: store.city
      },

      drop_details: {
        name: shippingAddress.fullName,
        contact_number: shippingAddress.phone,
        latitude: shippingAddress.latitude,
        longitude: shippingAddress.longitude,
        address: shippingAddress.address,
        city: shippingAddress.city
      },

      order_items: orderItems.map((item: any) => ({
        id: item.product,
        quantity: item.qty,
        price: item.price
      }))
    };

    let uengageResponse: any = null;

    try {
      uengageResponse = await axios.post(
        `${process.env.UENGAGE_BASE}/createTask`,
        uengagePayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'access-token': process.env.UENGAGE_TOKEN
          }
        }
      );

      createdOrder.uengage = {
        taskId: uengageResponse.data.taskId,
        vendorOrderId: uengageResponse.data.vendor_order_id,
        statusCode: uengageResponse.data.status_code || 'CREATED',
        message: uengageResponse.data.message || 'Task created successfully'
      };

      await createdOrder.save();

    } catch (uengageError: any) {
      console.error(
        'U-Engage task creation failed:',
        uengageError.response?.data || uengageError.message
      );

      createdOrder.uengage = {
        statusCode: 'FAILED',
        message: 'Failed to create delivery task'
      };
      await createdOrder.save();
    }

    /* ---------------- 5️⃣ CLEAR USER CART ---------------- */

    const user = await User.findById(req.user._id);
    if (user) {
      user.cart = [];
      await user.save();
    }

    /* ---------------- RESPONSE ---------------- */

    res.status(201).json({
      message: 'Order placed successfully',
      order: createdOrder,
      uengage: uengageResponse?.data || null
    });

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
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('user', 'username email')
      .sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

// @desc    Get order by ID
// @route   GET /api/user/orders/:id
// @access  Private
export const getOrderById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order belongs to the authenticated user
    const orderUserId = (order.user as any).id 
      ? (order.user as any).id.toString() 
      : (order.user as any).toString();
    
    if (orderUserId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
};
// @desc    Cancel order
// @route   PUT /api/user/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ message: 'Cancellation reason is required' });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Ownership check
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Business rules
    if (order.isDelivered) {
      return res.status(400).json({ message: 'Cannot cancel delivered order' });
    }

    if (order.status === 'out_for_delivery') {
      return res.status(400).json({ 
        message: 'Order is out for delivery. Please contact support to cancel.' 
      });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Order already cancelled' });
    }

    /* ---------- CANCEL U-ENGAGE TASK ---------- */
    let uengageCancelled = false;
    
    if (order.uengage?.taskId) {
      try {
        const uengagePayload = {
          storeId: process.env.STORE_ID,
          taskId: order.uengage.taskId
        };

        const { data } = await axios.post(
          `${process.env.UENGAGE_BASE}/cancelTask`,
          uengagePayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'access-token': process.env.UENGAGE_TOKEN
            }
          }
        );

        // Save U-Engage response
        order.uengage.statusCode = data.status_code || 'CANCELLED';
        order.uengage.message = data.message || 'Order cancelled in U-Engage';
        uengageCancelled = true;

        console.log('U-Engage cancellation successful:', data);

      } catch (uengageError: any) {
        console.error(
          'U-Engage cancel failed:',
          uengageError.response?.data || uengageError.message
        );

        // Don't block order cancellation if U-Engage fails
        order.uengage.statusCode = 'CANCEL_FAILED';
        order.uengage.message = 'Failed to cancel delivery task';
      }
    }

    /* ---------- UPDATE ORDER ---------- */
    order.status = 'cancelled';
    order.cancelReason = reason;
    order.cancelledAt = new Date();

    await order.save();

    return res.json({
      message: 'Order cancelled successfully',
      uengageCancelled,
      order
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({ message: 'Failed to cancel order' });
  }
};




// @desc    Track order status via U-Engage
// @route   GET /api/user/orders/:id/track
// @access  Private
export const trackOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Ownership check
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (!order.uengage?.taskId) {
      return res.status(400).json({ 
        message: 'Tracking not available for this order',
        status: order.status
      });
    }

    /* ---------- CALL U-ENGAGE TRACK API ---------- */
    const payload = {
      storeId: process.env.STORE_ID,
      taskId: order.uengage.taskId
    };

    const { data } = await axios.post(
      `${process.env.UENGAGE_BASE}/trackTaskStatus`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'access-token': process.env.UENGAGE_TOKEN
        }
      }
    );

    /* ---------- MAP U-ENGAGE STATUS TO LOCAL STATUS ---------- */
    const statusMap: Record<string, string> = {
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

    const uengageStatus = data.status_code;

    // Update order fields
    order.uengage.statusCode = uengageStatus;
    order.uengage.message = data.message || '';

    if (statusMap[uengageStatus]) {
      order.status = statusMap[uengageStatus] as any;
    }

    if (uengageStatus === 'DELIVERED') {
      order.isDelivered = true;
      order.deliveredAt = new Date();
    }

    if (uengageStatus === 'CANCELLED') {
      order.status = 'cancelled';
      if (!order.cancelReason) {
        order.cancelReason = 'Cancelled by delivery partner';
      }
    }

    await order.save();

    /* ---------- RESPONSE ---------- */
    return res.json({
      status: uengageStatus,
      statusLabel: data.message || uengageStatus,
      tracking: data.data || null,
      order: {
        status: order.status,
        isDelivered: order.isDelivered,
        deliveredAt: order.deliveredAt
      }
    });

  } catch (error: any) {
    console.error(
      'Track order error:',
      error.response?.data || error.message
    );

    return res.status(500).json({
      message: 'Failed to track order',
      error: error.response?.data?.message || error.message
    });
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

export const searchLocation = async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: "q is required" });
  }

  try {
    const response = await fetch(
      `https://api.olamaps.io/places/v1/geocode?query=${encodeURIComponent(
        q as string
      )}&api_key=${process.env.OLA_PLACES_API_KEY}`,
      {
        headers: {
          Accept: "*/*",
        },
      }
    );

    const data = await response.json();

    const results = (data?.data || []).map((item: any) => ({
      lat: item.geometry.location.lat.toString(),
      lng: item.geometry.location.lng.toString(),
      display_name: item.formatted_address || item.name,
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
};

  
// @desc    Reverse geocode coordinates to address
// @route   GET /user/reverse-geocode
// @access  Public
export const reverseGeocode = async (req: Request, res: Response) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  try {
    const latlng = encodeURIComponent(`${lat},${lng}`);

    const response = await fetch(
      `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${latlng}&api_key=${process.env.OLA_PLACES_API_KEY}`,
      {
        headers: {
          Accept: "*/*",
        },
      }
    );

    const data = await response.json();

    console.log("RAW Ola response:", JSON.stringify(data, null, 2));

    let address = `${lat}, ${lng}`;

    // ✅ Handle ALL Ola response formats
    if (data?.formatted_address) {
      address = data.formatted_address;
    } else if (data?.name) {
      address = data.name;
    } else if (Array.isArray(data?.data) && data.data.length > 0) {
      address =
        data.data[0].formatted_address ||
        data.data[0].name ||
        address;
    }

    console.log("FINAL address:", address);
    res.json({ address });
  } catch (err) {
    console.error("Reverse geocode error:", err);
    res.json({ address: `${lat}, ${lng}` });
  }
};





export const checkAvailability = async (req: AuthenticatedRequest, res: Response) => {

  try {
    const { pickup, drop } = req.body;
   

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
    console.log("Uengage",response)
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