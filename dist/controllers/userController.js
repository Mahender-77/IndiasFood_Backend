"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAddress = exports.deleteAddress = exports.UpdateAddress = exports.addNewAddress = exports.getSavedAddress = exports.subscribeNewsletter = exports.checkAvailability = exports.geocodeAddress = exports.reverseGeocode = exports.searchLocation = exports.getDeliverySettings = exports.trackOrderStatus = exports.cancelOrder = exports.getOrderById = exports.getUserOrders = exports.createOrder = exports.toggleWishlist = exports.getUserWishlist = exports.mergeCart = exports.updateCart = exports.getUserCart = void 0;
const axios_1 = __importDefault(require("axios"));
const DeliverySettings_1 = __importDefault(require("../models/DeliverySettings"));
const Order_1 = __importDefault(require("../models/Order"));
const Product_1 = __importDefault(require("../models/Product"));
const User_1 = __importDefault(require("../models/User"));
// @desc    Get user cart
// @route   GET /api/user/cart
// @access  Private
const getUserCart = async (req, res) => {
    const user = await User_1.default.findById(req.user._id).populate('cart.product');
    if (user) {
        res.json(user.cart);
    }
    else {
        res.status(404).json({ message: 'User not found' });
    }
};
exports.getUserCart = getUserCart;
// @desc    Add/update/remove item from cart
// @route   POST /api/user/cart
// @access  Private
const updateCart = async (req, res) => {
    try {
        const { productId, qty, selectedVariantIndex = 0 } = req.body;
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: 'Not authorized, user ID missing' });
        }
        const user = await User_1.default.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const product = await Product_1.default.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        // Find item index considering both productId and selectedVariantIndex
        const itemIndex = user.cart.findIndex((item) => {
            const itemProductId = item.product._id ? item.product._id.toString() : item.product.toString();
            const itemVariantIndex = item.selectedVariantIndex !== undefined ? item.selectedVariantIndex : 0;
            return itemProductId === productId && itemVariantIndex === selectedVariantIndex;
        });
        if (itemIndex > -1) {
            // Update quantity or remove item
            if (qty > 0) {
                user.cart[itemIndex].qty = qty;
                user.cart[itemIndex].selectedVariantIndex = selectedVariantIndex;
            }
            else {
                user.cart.splice(itemIndex, 1);
            }
        }
        else if (qty > 0) {
            // Add new item with variant index
            user.cart.push({
                product: productId,
                qty,
                selectedVariantIndex
            });
        }
        else {
            // If trying to remove item that doesn't exist, just return current cart
            await user.populate('cart.product');
            return res.json(user.cart);
        }
        await user.save();
        await user.populate('cart.product');
        res.json(user.cart);
    }
    catch (error) {
        console.error('Error in updateCart:', error);
        res.status(500).json({
            message: 'Error updating cart',
            error: error.message
        });
    }
};
exports.updateCart = updateCart;
// POST /api/user/cart/merge
const mergeCart = async (req, res) => {
    const { items } = req.body; // [{ productId, qty, selectedVariantIndex }]
    const user = await User_1.default.findById(req.user._id);
    if (!user)
        return res.status(404).json({ message: 'User not found' });
    for (const incoming of items) {
        const index = user.cart.findIndex((item) => item.product.toString() === incoming.productId &&
            (item.selectedVariantIndex ?? 0) === (incoming.selectedVariantIndex ?? 0));
        if (index > -1) {
            user.cart[index].qty += incoming.qty;
        }
        else {
            user.cart.push(incoming);
        }
    }
    await user.save();
    await user.populate('cart.product');
    res.json(user.cart);
};
exports.mergeCart = mergeCart;
// @desc    Get user wishlist
// @route   GET /api/user/wishlist
// @access  Private
const getUserWishlist = async (req, res) => {
    const user = await User_1.default.findById(req.user._id).populate('wishlist');
    if (user) {
        res.json(user.wishlist);
    }
    else {
        res.status(404).json({ message: 'User not found' });
    }
};
exports.getUserWishlist = getUserWishlist;
// @desc    Toggle product in wishlist
// @route   POST /api/user/wishlist
// @access  Private
const toggleWishlist = async (req, res) => {
    const { productId } = req.body;
    const user = await User_1.default.findById(req.user._id);
    if (user) {
        const product = await Product_1.default.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const itemIndex = user.wishlist.findIndex((item) => item.toString() === productId);
        if (itemIndex > -1) {
            user.wishlist.splice(itemIndex, 1);
        }
        else {
            user.wishlist.push(productId);
        }
        await user.save();
        res.json(user.wishlist);
    }
    else {
        res.status(404).json({ message: 'User not found' });
    }
};
exports.toggleWishlist = toggleWishlist;
// @desc    Create new order
// @route   POST /api/user/checkout
// @access  Private
const createOrder = async (req, res) => {
    try {
        const { orderItems, shippingAddress, paymentMethod, taxPrice, shippingPrice, totalPrice, 
        // NEW: Address saving fields
        saveAddress, addressData } = req.body;
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
        const product = await Product_1.default.findById(firstItem.product).select('store');
        if (!product) {
            return res.status(400).json({ message: 'Product not found' });
        }
        const storeId = product.store;
        /* ---------------- 2️⃣ GET STORE DETAILS FROM DELIVERY SETTINGS ---------------- */
        const deliverySettings = await DeliverySettings_1.default.findOne({
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
        const store = deliverySettings.storeLocations.find((s) => s.storeId.toString() === storeId.toString());
        if (!store) {
            return res.status(400).json({ message: 'Store location not found' });
        }
        /* ---------------- 3️⃣ CREATE ORDER ---------------- */
        const order = new Order_1.default({
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
            order_items: orderItems.map((item) => ({
                id: item.product,
                quantity: item.qty,
                price: item.price
            }))
        };
        let uengageResponse = null;
        try {
            uengageResponse = await axios_1.default.post(`${process.env.UENGAGE_BASE}/createTask`, uengagePayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'access-token': process.env.UENGAGE_TOKEN
                }
            });
            createdOrder.uengage = {
                taskId: uengageResponse.data.taskId,
                vendorOrderId: uengageResponse.data.vendor_order_id,
                statusCode: uengageResponse.data.status_code || 'CREATED',
                message: uengageResponse.data.message || 'Task created successfully'
            };
            await createdOrder.save();
        }
        catch (uengageError) {
            console.error('U-Engage task creation failed:', uengageError.response?.data || uengageError.message);
            createdOrder.uengage = {
                statusCode: 'FAILED',
                message: 'Failed to create delivery task'
            };
            await createdOrder.save();
        }
        /* ---------------- 5️⃣ CLEAR USER CART ---------------- */
        const user = await User_1.default.findById(req.user._id);
        if (user) {
            user.cart = [];
            /* ---------------- 🆕 6️⃣ SAVE ADDRESS (NEW FEATURE) ---------------- */
            // Only save if requested AND address data is provided
            if (saveAddress && addressData) {
                try {
                    // Check if address already exists (by comparing coordinates and address line)
                    const existingAddress = user.addresses.find(addr => addr.latitude === addressData.latitude &&
                        addr.longitude === addressData.longitude &&
                        addr.addressLine1 === addressData.addressLine1);
                    // Only add if it doesn't already exist
                    if (!existingAddress) {
                        // If this is the first address, make it default
                        const isFirstAddress = user.addresses.length === 0;
                        // Create new address object
                        const newAddress = {
                            fullName: addressData.fullName,
                            phone: addressData.phone,
                            addressLine1: addressData.addressLine1,
                            addressLine2: addressData.addressLine2 || '',
                            city: addressData.city,
                            postalCode: addressData.postalCode,
                            country: addressData.country || 'India',
                            latitude: addressData.latitude,
                            longitude: addressData.longitude,
                            locationName: addressData.locationName || '',
                            isDefault: isFirstAddress
                        };
                        // Push to addresses - Mongoose will auto-generate _id
                        user.addresses.push(newAddress);
                        console.log('✅ Address saved to user profile');
                    }
                    else {
                        console.log('ℹ️ Address already exists, skipping save');
                    }
                }
                catch (addressError) {
                    // Log error but don't fail the order
                    console.error('⚠️ Error saving address (non-critical):', addressError);
                }
            }
            await user.save();
        }
        /* ---------------- RESPONSE ---------------- */
        res.status(201).json({
            message: 'Order placed successfully',
            order: createdOrder,
            uengage: uengageResponse?.data || null
        });
    }
    catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            message: 'Error creating order',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
exports.createOrder = createOrder;
// @desc    Get logged in user orders
// @route   GET /api/user/orders
// @access  Private
const getUserOrders = async (req, res) => {
    try {
        const orders = await Order_1.default.find({ user: req.user._id })
            .populate('user', 'username email')
            .sort({ createdAt: -1 });
        res.json(orders);
    }
    catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({ message: 'Failed to fetch orders' });
    }
};
exports.getUserOrders = getUserOrders;
// @desc    Get order by ID
// @route   GET /api/user/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
    try {
        const order = await Order_1.default.findById(req.params.id).populate('user', 'name email');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        // Check if order belongs to the authenticated user
        const orderUserId = order.user.id
            ? order.user.id.toString()
            : order.user.toString();
        if (orderUserId !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to view this order' });
        }
        res.json(order);
    }
    catch (error) {
        console.error('Get order by ID error:', error);
        res.status(500).json({ message: 'Failed to fetch order' });
    }
};
exports.getOrderById = getOrderById;
// @desc    Cancel order
// @route   PUT /api/user/orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason?.trim()) {
            return res.status(400).json({ message: 'Cancellation reason is required' });
        }
        const order = await Order_1.default.findById(req.params.id);
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
                const { data } = await axios_1.default.post(`${process.env.UENGAGE_BASE}/cancelTask`, uengagePayload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'access-token': process.env.UENGAGE_TOKEN
                    }
                });
                // Save U-Engage response
                order.uengage.statusCode = data.status_code || 'CANCELLED';
                order.uengage.message = data.message || 'Order cancelled in U-Engage';
                uengageCancelled = true;
                console.log('U-Engage cancellation successful:', data);
            }
            catch (uengageError) {
                console.error('U-Engage cancel failed:', uengageError.response?.data || uengageError.message);
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
    }
    catch (error) {
        console.error('Cancel order error:', error);
        return res.status(500).json({ message: 'Failed to cancel order' });
    }
};
exports.cancelOrder = cancelOrder;
// @desc    Track order status via U-Engage
// @route   GET /api/user/orders/:id/track
// @access  Private
const trackOrderStatus = async (req, res) => {
    try {
        const order = await Order_1.default.findById(req.params.id);
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
        const { data } = await axios_1.default.post(`${process.env.UENGAGE_BASE}/trackTaskStatus`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'access-token': process.env.UENGAGE_TOKEN
            }
        });
        /* ---------- MAP U-ENGAGE STATUS TO LOCAL STATUS ---------- */
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
        const uengageStatus = data.status_code;
        // Update order fields
        order.uengage.statusCode = uengageStatus;
        order.uengage.message = data.message || '';
        if (statusMap[uengageStatus]) {
            order.status = statusMap[uengageStatus];
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
    }
    catch (error) {
        console.error('Track order error:', error.response?.data || error.message);
        return res.status(500).json({
            message: 'Failed to track order',
            error: error.response?.data?.message || error.message
        });
    }
};
exports.trackOrderStatus = trackOrderStatus;
// GET DELIVERY SETTINGS (ALL DATA)
const getDeliverySettings = async (req, res) => {
    try {
        const settings = await DeliverySettings_1.default.findOne();
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
    }
    catch (error) {
        res.status(500).json({
            message: 'Server error'
        });
    }
};
exports.getDeliverySettings = getDeliverySettings;
const searchLocation = async (req, res) => {
    const { q } = req.query;
    if (!q || String(q).trim().length < 3) {
        return res.json([]); // return empty array safely
    }
    try {
        console.log("🔎 Ola autocomplete for:", q);
        const response = await fetch(`https://api.olamaps.io/places/v1/autocomplete?input=${encodeURIComponent(q)}&api_key=${process.env.OLA_PLACES_API_KEY}`, { headers: { Accept: "*/*" } });
        const text = await response.text();
        if (!response.ok) {
            console.error("❌ Ola autocomplete error:", text);
            return res.json([]);
        }
        const data = JSON.parse(text);
        const results = (data?.predictions || []).map((item) => ({
            placeId: item.place_id,
            title: item.structured_formatting?.main_text || item.description,
            description: item.description,
        }));
        console.log("✅ Autocomplete results:", results.length);
        res.json(results);
    }
    catch (err) {
        console.error("❌ Search exception:", err);
        res.json([]);
    }
};
exports.searchLocation = searchLocation;
// @desc    Reverse geocode coordinates to address
// @route   GET /user/reverse-geocode
// @access  Public
const reverseGeocode = async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
        return res.status(400).json({ error: "lat and lng are required" });
    }
    try {
        const latlng = encodeURIComponent(`${lat},${lng}`);
        const response = await fetch(`https://api.olamaps.io/places/v1/reverse-geocode?latlng=${latlng}&api_key=${process.env.OLA_PLACES_API_KEY}`, {
            headers: {
                Accept: "*/*",
            },
        });
        const data = await response.json();
        // console.log("RAW Ola response:", JSON.stringify(data, null, 2));
        // Default values
        let fullAddress = `${lat}, ${lng}`;
        let city = '';
        let postalCode = '';
        let addressLine1 = '';
        // ✅ Extract from results array (primary response format)
        if (data?.results && Array.isArray(data.results) && data.results.length > 0) {
            const firstResult = data.results[0];
            // Get formatted address
            fullAddress = firstResult.formatted_address || fullAddress;
            // Extract address components
            const components = firstResult.address_components || [];
            for (const component of components) {
                const types = component.types || [];
                if (types.includes('locality')) {
                    city = component.long_name || component.short_name;
                }
                else if (types.includes('postal_code')) {
                    postalCode = component.long_name || component.short_name;
                }
            }
            // Extract first part for address line 1
            addressLine1 = firstResult.name || fullAddress.split(',')[0]?.trim() || '';
        }
        const responseData = {
            address: fullAddress,
            addressLine1,
            city,
            postalCode,
            lat,
            lng
        };
        console.log("FINAL parsed address:", responseData);
        res.json(responseData);
    }
    catch (err) {
        console.error("Reverse geocode error:", err);
        res.json({
            address: `${lat}, ${lng}`,
            addressLine1: '',
            city: '',
            postalCode: '',
            lat,
            lng
        });
    }
};
exports.reverseGeocode = reverseGeocode;
const geocodeAddress = async (req, res) => {
    const { address } = req.query;
    if (!address || String(address).trim().length < 3) {
        return res.status(400).json({ error: "Valid address is required" });
    }
    try {
        const response = await fetch(`https://api.olamaps.io/places/v1/geocode?address=${encodeURIComponent(address)}&api_key=${process.env.OLA_PLACES_API_KEY}`, {
            headers: { Accept: "*/*" },
        });
        const text = await response.text();
        if (!response.ok) {
            console.error("❌ Ola error response:", text);
            return res.status(400).json({ error: "Ola geocode failed" });
        }
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            return res.status(400).json({ error: "Invalid Ola response" });
        }
        console.log("🧾 RAW Ola geocode:", JSON.stringify(data, null, 2));
        // 🔍 Handle multiple possible response shapes
        const results = data?.geocodingResults ||
            data?.results ||
            data?.data;
        if (!Array.isArray(results) || results.length === 0) {
            return res.status(400).json({ error: "No geocode results" });
        }
        const geometry = results[0]?.geometry;
        let lat;
        let lng;
        // ✅ Ola Maps format → coordinates: [lng, lat]
        if (Array.isArray(geometry?.coordinates)) {
            lng = geometry.coordinates[0];
            lat = geometry.coordinates[1];
        }
        // ✅ fallback (Google-like format, future-proof)
        else if (typeof geometry?.location?.lat === "number" &&
            typeof geometry?.location?.lng === "number") {
            lat = geometry.location.lat;
            lng = geometry.location.lng;
        }
        if (typeof lat !== "number" || typeof lng !== "number") {
            return res.status(400).json({ error: "No coordinates found" });
        }
        return res.json({ lat, lng });
    }
    catch (err) {
        console.error("❌ Geocode exception:", err);
        return res.status(500).json({ error: "Geocode failed" });
    }
};
exports.geocodeAddress = geocodeAddress;
const checkAvailability = async (req, res) => {
    try {
        const { pickup, drop } = req.body;
        console.log("UEngage", req.body);
        const response = await axios_1.default.post(process.env.UENGAGE_BASE + "/getServiceability", {
            store_id: process.env.STORE_ID,
            pickupDetails: pickup,
            dropDetails: drop
        }, {
            headers: {
                "access-token": process.env.UENGAGE_TOKEN,
                "Content-Type": "application/json"
            }
        });
        console.log("Uengage", response);
        res.json(response.data);
    }
    catch (err) {
        console.log(err.response?.data || err.message);
        res.status(500).json({ error: "Serviceability failed" });
    }
};
exports.checkAvailability = checkAvailability;
// @desc    Subscribe to newsletter
// @route   POST /api/user/newsletter/subscribe
// @access  Public (can be used by non-logged-in users)
const subscribeNewsletter = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }
    try {
        // Check if user exists with this email
        const user = await User_1.default.findOne({ email });
        if (user) {
            // Update existing user's newsletter subscription
            user.newsletterSubscribed = true;
            await user.save();
            res.json({ message: 'Successfully subscribed to newsletter' });
        }
        else {
            // For non-registered users, we could create a newsletter subscriber record
            // For now, we'll just return success since this is a simple implementation
            res.json({ message: 'Successfully subscribed to newsletter' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.subscribeNewsletter = subscribeNewsletter;
const getSavedAddress = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user._id).select('addresses');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            success: true,
            addresses: user.addresses || []
        });
    }
    catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({ message: 'Failed to fetch addresses' });
    }
};
exports.getSavedAddress = getSavedAddress;
const addNewAddress = async (req, res) => {
    try {
        const { fullName, phone, addressLine1, addressLine2, city, postalCode, country, latitude, longitude, locationName, isDefault } = req.body;
        // Validate required fields
        if (!fullName || !phone || !addressLine1 || !city || !postalCode || !latitude || !longitude) {
            return res.status(400).json({
                message: 'Missing required fields',
                required: ['fullName', 'phone', 'addressLine1', 'city', 'postalCode', 'latitude', 'longitude']
            });
        }
        const user = await User_1.default.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // If this is set as default, unset other defaults
        if (isDefault) {
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
        }
        // Create new address object (TypeScript will allow this for DocumentArray)
        const newAddress = {
            fullName,
            phone,
            addressLine1,
            addressLine2: addressLine2 || '',
            city,
            postalCode,
            country: country || 'India',
            latitude,
            longitude,
            locationName: locationName || '',
            isDefault: isDefault || false
        };
        // Push to addresses array - Mongoose will auto-generate _id
        user.addresses.push(newAddress); // Type assertion needed for DocumentArray
        await user.save();
        // Get the newly added address (with _id)
        const addedAddress = user.addresses[user.addresses.length - 1];
        res.status(201).json({
            success: true,
            message: 'Address added successfully',
            address: addedAddress
        });
    }
    catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ message: 'Failed to add address' });
    }
};
exports.addNewAddress = addNewAddress;
const UpdateAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        const updateData = req.body;
        const user = await User_1.default.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
        if (addressIndex === -1) {
            return res.status(404).json({ message: 'Address not found' });
        }
        // If setting as default, unset others
        if (updateData.isDefault) {
            user.addresses.forEach((addr, idx) => {
                if (idx !== addressIndex) {
                    addr.isDefault = false;
                }
            });
        }
        // Update address fields individually to preserve _id
        const address = user.addresses[addressIndex];
        if (updateData.fullName !== undefined)
            address.fullName = updateData.fullName;
        if (updateData.phone !== undefined)
            address.phone = updateData.phone;
        if (updateData.addressLine1 !== undefined)
            address.addressLine1 = updateData.addressLine1;
        if (updateData.addressLine2 !== undefined)
            address.addressLine2 = updateData.addressLine2;
        if (updateData.city !== undefined)
            address.city = updateData.city;
        if (updateData.postalCode !== undefined)
            address.postalCode = updateData.postalCode;
        if (updateData.country !== undefined)
            address.country = updateData.country;
        if (updateData.latitude !== undefined)
            address.latitude = updateData.latitude;
        if (updateData.longitude !== undefined)
            address.longitude = updateData.longitude;
        if (updateData.locationName !== undefined)
            address.locationName = updateData.locationName;
        if (updateData.isDefault !== undefined)
            address.isDefault = updateData.isDefault;
        await user.save();
        res.json({
            success: true,
            message: 'Address updated successfully',
            address: user.addresses[addressIndex]
        });
    }
    catch (error) {
        console.error('Error updating address:', error);
        res.status(500).json({ message: 'Failed to update address' });
    }
};
exports.UpdateAddress = UpdateAddress;
const deleteAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        const user = await User_1.default.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const initialLength = user.addresses.length;
        // Use pull method for better type safety
        user.addresses.pull({ _id: addressId });
        if (user.addresses.length === initialLength) {
            return res.status(404).json({ message: 'Address not found' });
        }
        await user.save();
        res.json({
            success: true,
            message: 'Address deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({ message: 'Failed to delete address' });
    }
};
exports.deleteAddress = deleteAddress;
const defaultAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        const user = await User_1.default.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        let found = false;
        user.addresses.forEach(addr => {
            if (addr._id.toString() === addressId) {
                addr.isDefault = true;
                found = true;
            }
            else {
                addr.isDefault = false;
            }
        });
        if (!found) {
            return res.status(404).json({ message: 'Address not found' });
        }
        await user.save();
        res.json({
            success: true,
            message: 'Default address updated successfully'
        });
    }
    catch (error) {
        console.error('Error setting default address:', error);
        res.status(500).json({ message: 'Failed to set default address' });
    }
};
exports.defaultAddress = defaultAddress;
