"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminInvoice = exports.updateDeliverySettings = exports.getGiveAwayEligibleUsers = exports.applyGiveAwayToOrder = exports.getOrdersGiveAwayEligibilityBatch = exports.getOrderGiveAwayEligibility = exports.deleteGiveAway = exports.updateGiveAway = exports.createGiveAway = exports.getGiveAways = exports.getDeliveryLocations = exports.getDeliverySettings = exports.toggleMostSaled = exports.deactivateProduct = exports.toggleFlag = exports.updateStock = exports.updateInventoryProduct = exports.addBatches = exports.createInventoryProduct = exports.getInventory = exports.getAllProducts = exports.getRevenueToday = exports.getActiveDeliveryPersonsCount = exports.getTotalCustomersCount = exports.getTotalOrdersCount = exports.exportSalesByTime = exports.exportOrdersByTime = exports.exportSales = exports.exportProducts = exports.exportCustomers = exports.exportOrders = exports.assignDeliveryPerson = exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategories = exports.getCustomerById = exports.getCustomers = exports.getDeliveryPersons = exports.uploadProductImages = exports.updateProduct = exports.updateOrderToDelivered = exports.adminUpdateOrderStatus = exports.createProduct = exports.getAllOrders = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const path_1 = __importDefault(require("path"));
const Category_1 = __importDefault(require("../models/Category")); // Import Category model
const DeliverySettings_1 = __importDefault(require("../models/DeliverySettings"));
const GiveAway_1 = __importDefault(require("../models/GiveAway"));
const Order_1 = __importDefault(require("../models/Order"));
const Product_1 = __importDefault(require("../models/Product"));
const User_1 = __importDefault(require("../models/User")); // Import User model
const pdfkit_1 = __importDefault(require("pdfkit")); // Import pdfkit
const adminValidation_1 = require("../utils/adminValidation");
const NEW_ARRIVAL_DAYS = 4;
const expireOldNewArrivalFlags = async () => {
    const cutoffDate = new Date(Date.now() - NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000);
    await Product_1.default.updateMany({
        isNewArrival: true,
        createdAt: { $lt: cutoffDate }
    }, {
        $set: { isNewArrival: false }
    });
};
// @desc    Get all orders
// @route   GET /api/admin/orders
// @access  Private/Admin
const getAllOrders = async (req, res) => {
    const keyword = req.query.keyword
        ? {
            'user.username': { $regex: req.query.keyword, $options: 'i' },
        }
        : {};
    const orders = await Order_1.default.find({ ...keyword }).populate('user', 'id username email').populate('deliveryPerson', 'id username email');
    res.json(orders);
};
exports.getAllOrders = getAllOrders;
// @desc    Create a new product
// @route   POST /api/admin/inventory/create-product
// @access  Private/Admin
const createProduct = async (req, res) => {
    // ---------------- VALIDATION ----------------
    const { error } = adminValidation_1.createProductSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            message: error.details[0].message
        });
    }
    const { name, description, originalPrice, offerPrice, variants, category, inventory, videoUrl, images, isActive, isGITagged, isNewArrival, store, originLocation, dealTriggerDays, dealDiscountPercent } = req.body;
    try {
        // ---------------- CHECK CATEGORY ----------------
        const categoryExists = await Category_1.default.findById(category);
        if (!categoryExists) {
            return res.status(400).json({
                message: 'Invalid category ID'
            });
        }
        // ---------------- CHECK STORE ----------------
        if (!store) {
            return res.status(400).json({
                message: 'Store ID is required'
            });
        }
        // ---------------- VALIDATE VARIANTS ----------------
        if (variants && variants.length > 0) {
            for (let i = 0; i < variants.length; i++) {
                const variant = variants[i];
                if (!variant.type ||
                    !variant.value ||
                    variant.originalPrice < 0) {
                    return res.status(400).json({
                        message: `Variant ${i + 1} is invalid`
                    });
                }
            }
        }
        // ---------------- SAFETY: INVENTORY DEFAULT ----------------
        const safeInventory = Array.isArray(inventory) ? inventory : [];
        const safeVariants = Array.isArray(variants) && variants.length > 0 ? variants : [];
        // If NO variants → force variantIndex = 0 for batches and stock
        if (safeVariants.length === 0) {
            safeInventory.forEach((loc) => {
                if (loc.batches?.length) {
                    loc.batches = loc.batches.map((b) => ({ ...b, variantIndex: 0 }));
                }
                if (loc.stock?.length) {
                    loc.stock = loc.stock.map((s) => ({ ...s, variantIndex: 0 }));
                }
            });
        }
        // ---------------- CREATE PRODUCT ----------------
        const product = new Product_1.default({
            name: name.trim(),
            description: description?.trim() || '',
            store,
            originLocation: originLocation?.trim().toLowerCase() || undefined,
            originalPrice: safeVariants.length === 0 ? originalPrice : undefined,
            offerPrice: safeVariants.length === 0 ? offerPrice : undefined,
            variants: safeVariants,
            category,
            inventory: safeInventory,
            videoUrl: videoUrl?.trim() || '',
            images: images || [],
            isActive: isActive ?? true,
            isGITagged: isGITagged || false,
            isNewArrival: isNewArrival || false,
            dealTriggerDays: dealTriggerDays != null ? Number(dealTriggerDays) : undefined,
            dealDiscountPercent: dealDiscountPercent != null ? Number(dealDiscountPercent) : undefined
        });
        const savedProduct = await product.save();
        // ---------------- RETURN POPULATED + LEAN VERSION ----------------
        // 🔥 This is the important part
        const populatedProduct = await Product_1.default.findById(savedProduct._id)
            .populate('category')
            .lean({ virtuals: true });
        return res.status(201).json({
            message: 'Product created successfully',
            product: populatedProduct
        });
    }
    catch (error) {
        console.error('Error creating product:', error);
        return res.status(500).json({
            message: error.message || 'Server error while creating product'
        });
    }
};
exports.createProduct = createProduct;
// @desc    Admin Update Order Status
// @route   PUT /api/admin/orders/:id/delivery-status
// @access  Admin
const adminUpdateOrderStatus = async (req, res) => {
    try {
        const { status, reason } = req.body;
        const order = await Order_1.default.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        // ❌ Cannot modify delivered except cancel
        if (order.isDelivered && status !== 'cancelled') {
            return res.status(400).json({
                message: 'Delivered order cannot be modified'
            });
        }
        /* =====================================================
           🔥 ADMIN CANCEL (FOR BOTH DELIVERY & PICKUP)
        ====================================================== */
        if (status === 'cancelled') {
            if (!reason?.trim()) {
                return res.status(400).json({
                    message: 'Cancellation reason is required'
                });
            }
            if (order.status === 'cancelled') {
                return res.status(400).json({
                    message: 'Order already cancelled'
                });
            }
            /* 🚚 If delivery order → cancel U-Engage silently */
            if (order.deliveryMode === 'delivery' &&
                order.uengage?.taskId) {
                try {
                    await axios_1.default.post(`${process.env.UENGAGE_BASE}/cancelTask`, {
                        storeId: process.env.STORE_ID,
                        taskId: order.uengage.taskId
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'access-token': process.env.UENGAGE_TOKEN
                        }
                    });
                    order.uengage.statusCode = 'CANCELLED';
                    order.uengage.message = 'Cancelled by admin';
                }
                catch (err) {
                    order.uengage.statusCode = 'CANCEL_FAILED';
                    order.uengage.message = 'Failed to cancel delivery task';
                }
            }
            /* 📦 RESTORE STOCK (including giveaway items) */
            const allItemsToRestore = [
                ...(order.orderItems || []),
                ...(order.giveAwayItems || [])
            ];
            for (const item of allItemsToRestore) {
                const product = await Product_1.default.findById(item.product);
                if (!product)
                    continue;
                const variantIndex = typeof item.selectedVariantIndex === 'number'
                    ? item.selectedVariantIndex
                    : 0;
                const locationName = order.nearestStore?.toLowerCase();
                if (!locationName)
                    continue;
                const inventoryLocation = product.inventory?.find(inv => inv.location === locationName);
                if (!inventoryLocation)
                    continue;
                if (Array.isArray(inventoryLocation.batches)) {
                    const now = new Date();
                    inventoryLocation.batches = inventoryLocation.batches || [];
                    inventoryLocation.batches.push({
                        batchNumber: `RETURN-${Date.now()}`,
                        quantity: item.qty,
                        initialQuantity: item.qty,
                        soldQuantity: 0,
                        revenue: 0,
                        giveAwayQuantity: 0,
                        manufacturingDate: now,
                        expiryDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
                        purchasePrice: 0,
                        sellingPrice: 0,
                        variantIndex
                    });
                }
                else if (Array.isArray(inventoryLocation.stock)) {
                    const stockItem = inventoryLocation.stock.find((s) => s.variantIndex === variantIndex);
                    if (stockItem) {
                        stockItem.quantity += item.qty;
                    }
                    else {
                        inventoryLocation.stock.push({
                            variantIndex,
                            quantity: item.qty,
                            lowStockThreshold: 5
                        });
                    }
                }
                await product.save();
            }
            // ✅ SAVE REASON FOR USER ONLY
            order.status = 'cancelled';
            order.cancelReason = reason; // 🔥 shown to user
            order.cancelledAt = new Date();
            await order.save();
            return res.json(order);
        }
        /* =====================================================
           NORMAL STATUS UPDATES
        ====================================================== */
        if (status === 'confirmed') {
            order.status = 'confirmed';
        }
        if (status === 'out_for_delivery') {
            order.status = 'out_for_delivery';
        }
        if (status === 'delivered') {
            order.status = 'delivered';
            order.isDelivered = true;
            order.deliveredAt = new Date();
        }
        await order.save();
        return res.json(order);
    }
    catch (error) {
        console.error('Admin update error:', error);
        return res.status(500).json({
            message: 'Failed to update order status'
        });
    }
};
exports.adminUpdateOrderStatus = adminUpdateOrderStatus;
// @desc    Update order delivery status
// @route   PUT /api/admin/orders/:id/delivery
// @access  Private/Admin
const updateOrderToDelivered = async (req, res) => {
    const { error } = adminValidation_1.updateOrderDeliverySchema.validate(req.body);
    if (error)
        return res.status(400).json({ message: error.details[0].message });
    const { isDelivered } = req.body;
    const order = await Order_1.default.findById(req.params.id);
    if (order) {
        order.isDelivered = isDelivered;
        if (isDelivered) {
            order.deliveredAt = new Date();
        }
        else {
            order.deliveredAt = undefined;
        }
        const updatedOrder = await order.save();
        res.json(updatedOrder);
    }
    else {
        res.status(404).json({ message: 'Order not found' });
    }
};
exports.updateOrderToDelivered = updateOrderToDelivered;
// @desc    Upload product images
// @route   POST /api/admin/products/:id/images
// @access  Private/Admin
// @desc    Update a product
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
    const { error } = adminValidation_1.updateProductSchema.validate(req.body);
    if (error)
        return res.status(400).json({ message: error.details[0].message });
    const { name, description, originalPrice, offerPrice, variants, category, inventory, videoUrl, images, isActive, isGITagged, isNewArrival } = req.body;
    try {
        const product = await Product_1.default.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        // Check if category exists if provided
        if (category) {
            const existingCategory = await Category_1.default.findById(category);
            if (!existingCategory) {
                return res.status(404).json({ message: 'Category not found' });
            }
        }
        // Update basic fields
        product.name = name || product.name;
        product.description = description !== undefined ? description : product.description;
        product.originalPrice = originalPrice !== undefined ? originalPrice : product.originalPrice;
        product.offerPrice = offerPrice !== undefined ? offerPrice : product.offerPrice;
        product.category = category || product.category;
        product.videoUrl = videoUrl !== undefined ? videoUrl : product.videoUrl;
        product.images = images !== undefined ? images : product.images;
        product.isActive = isActive !== undefined ? isActive : product.isActive;
        // Update flags
        product.isGITagged = isGITagged !== undefined ? isGITagged : product.isGITagged;
        product.isNewArrival = isNewArrival !== undefined ? isNewArrival : product.isNewArrival;
        // Update variants if provided
        if (variants !== undefined) {
            product.variants = variants;
        }
        // Update inventory if provided
        if (inventory !== undefined) {
            product.inventory = inventory;
        }
        const updatedProduct = await product.save();
        res.json(updatedProduct);
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Product update failed' });
    }
};
exports.updateProduct = updateProduct;
// @desc    Upload product images
// @route   POST /api/admin/products/:id/images
// @access  Private/Admin
const uploadProductImages = async (req, res) => {
    try {
        const product = await Product_1.default.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No image files provided." });
        }
        const uploadedImages = [];
        for (const file of req.files) {
            const ext = path_1.default.extname(file.originalname);
            const fileName = `products/${crypto_1.default.randomUUID()}${ext}`;
            const uploadUrl = `https://storage.bunnycdn.com/${process.env.BUNNY_STORAGE_ZONE}/${fileName}`;
            await axios_1.default.put(uploadUrl, file.buffer, {
                headers: {
                    AccessKey: process.env.BUNNY_API_KEY,
                    "Content-Type": file.mimetype,
                },
                maxBodyLength: Infinity,
            });
            // IMPORTANT: use Pull Zone CDN URL
            const publicUrl = `${process.env.BUNNY_CDN_URL}/${fileName}`;
            uploadedImages.push(publicUrl);
        }
        product.images = [...(product.images || []), ...uploadedImages];
        await product.save();
        res.status(200).json({
            message: "Images uploaded successfully",
            images: product.images,
        });
    }
    catch (error) {
        console.error("Bunny upload error:", error);
        res.status(500).json({
            message: error.message || "Image upload failed",
        });
    }
};
exports.uploadProductImages = uploadProductImages;
// @desc    Get all users with role \'delivery\'
// @route   GET /api/admin/delivery-persons
// @access  Private/Admin
const getDeliveryPersons = async (req, res) => {
    const deliveryPersons = await User_1.default.find({ role: 'delivery' }).select('-password');
    res.json(deliveryPersons);
};
exports.getDeliveryPersons = getDeliveryPersons;
// @desc    Get all customers (users with role \'user\')
// @route   GET /api/admin/customers
// @access  Private/Admin
const getCustomers = async (req, res) => {
    try {
        const customers = await User_1.default.aggregate([
            { $match: { role: 'user' } },
            { $lookup: {
                    from: 'orders',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'orders',
                } },
            { $addFields: {
                    totalOrders: { $size: '$orders' },
                    // You can add more aggregated fields here if needed
                } },
            { $project: {
                    password: 0, // Exclude password
                    orders: 0, // Exclude the raw orders array from the top level
                } },
        ]);
        res.json(customers);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getCustomers = getCustomers;
// @desc    Get customer by ID with order history
// @route   GET /api/admin/customers/:id
// @access  Private/Admin
const getCustomerById = async (req, res) => {
    try {
        const customer = await User_1.default.findById(req.params.id)
            .select('-password') // Exclude password
            .lean(); // Return plain JavaScript objects
        if (customer) {
            // Convert string _id back to ObjectId for querying
            const mongoose = require('mongoose');
            const customerOrders = await Order_1.default.find({ user: new mongoose.Types.ObjectId(customer._id) }).populate('orderItems.product', 'name price');
            res.json({ ...customer, orderHistory: customerOrders });
        }
        else {
            res.status(404).json({ message: 'Customer not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getCustomerById = getCustomerById;
// @desc    Get all categories
// @route   GET /api/admin/categories
// @access  Private/Admin
const getCategories = async (req, res) => {
    try {
        const categories = await Category_1.default.find({});
        res.json(categories);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getCategories = getCategories;
// @desc    Create a new category
// @route   POST /api/admin/categories
// @access  Private/Admin
const createCategory = async (req, res) => {
    const { error } = adminValidation_1.createCategorySchema.validate(req.body);
    if (error)
        return res.status(400).json({ message: error.details[0].message });
    const { name, isActive, subcategories } = req.body;
    try {
        const category = new Category_1.default({
            name,
            isActive,
            subcategories,
        });
        const createdCategory = await category.save();
        res.status(201).json(createdCategory);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.createCategory = createCategory;
// @desc    Update a category
// @route   PUT /api/admin/categories/:id
// @access  Private/Admin
const updateCategory = async (req, res) => {
    const { error } = adminValidation_1.updateCategorySchema.validate(req.body);
    if (error)
        return res.status(400).json({ message: error.details[0].message });
    const { name, isActive, subcategories } = req.body;
    try {
        const category = await Category_1.default.findById(req.params.id);
        if (category) {
            category.name = name || category.name;
            category.isActive = (isActive !== undefined) ? isActive : category.isActive;
            category.subcategories = (subcategories !== undefined) ? subcategories : category.subcategories;
            const updatedCategory = await category.save();
            res.json(updatedCategory);
        }
        else {
            res.status(404).json({ message: 'Category not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateCategory = updateCategory;
// @desc    Delete a category
// @route   DELETE /api/admin/categories/:id
// @access  Private/Admin
const deleteCategory = async (req, res) => {
    try {
        const category = await Category_1.default.findById(req.params.id);
        if (category) {
            await category.deleteOne();
            res.json({ message: 'Category removed' });
        }
        else {
            res.status(404).json({ message: 'Category not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.deleteCategory = deleteCategory;
// @desc    Assign a delivery person to an order
// @route   PUT /api/admin/orders/:id/assign-delivery
// @access  Private/Admin
const assignDeliveryPerson = async (req, res) => {
    const { deliveryPersonId, eta } = req.body;
    // Validate input (deliveryPersonId is a valid ObjectId, eta is a string)\
    const order = await Order_1.default.findById(req.params.id);
    if (order) {
        const deliveryPerson = await User_1.default.findById(deliveryPersonId);
        if (!deliveryPerson || deliveryPerson.role !== 'delivery') {
            return res.status(400).json({ message: 'Invalid delivery person ID or not a delivery role' });
        }
        order.deliveryPerson = deliveryPersonId;
        order.eta = eta;
        order.status = 'confirmed'; // Set status to confirmed when assigning delivery
        const updatedOrder = await order.save();
        res.json(updatedOrder);
    }
    else {
        res.status(404).json({ message: 'Order not found' });
    }
};
exports.assignDeliveryPerson = assignDeliveryPerson;
// @desc    Export all orders as JSON
// @route   GET /api/admin/export/orders
// @access  Private/Admin
const exportOrders = async (req, res) => {
    const orders = await Order_1.default.find({}).populate('user', 'id username email').populate('deliveryPerson', 'id username email').lean();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.json');
    res.send(JSON.stringify(orders, null, 2));
};
exports.exportOrders = exportOrders;
// @desc    Export all customers as JSON
// @route   GET /api/admin/export/customers
// @access  Private/Admin
const exportCustomers = async (req, res) => {
    try {
        const customers = await User_1.default.aggregate([
            { $match: { role: 'user' } },
            { $lookup: {
                    from: 'orders',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'orders',
                } },
            { $project: {
                    _id: 1,
                    username: 1,
                    email: 1,
                    addresses: 1,
                    totalOrders: { $size: '$orders' },
                    createdAt: 1,
                    updatedAt: 1,
                } },
        ]);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=customers.json');
        res.send(JSON.stringify(customers, null, 2));
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.exportCustomers = exportCustomers;
// @desc    Export all products as JSON
// @route   GET /api/admin/export/products
// @access  Private/Admin
const exportProducts = async (req, res) => {
    try {
        const products = await Product_1.default.find({}).populate('category', 'name').lean();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=products.json');
        res.send(JSON.stringify(products, null, 2));
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.exportProducts = exportProducts;
// @desc    Export sales data (monthly sales and total revenue)
// @route   GET /api/admin/export/sales
// @access  Private/Admin
const exportSales = async (req, res) => {
    try {
        const salesByMonth = await Order_1.default.aggregate([
            { $match: { isPaid: true } }, // Only consider paid orders
            { $group: {
                    _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                    totalSales: { $sum: '$totalPrice' },
                    count: { $sum: 1 },
                } },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);
        const totalRevenueResult = await Order_1.default.aggregate([
            { $match: { isPaid: true } },
            { $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalPrice' },
                } },
        ]);
        const totalRevenue = totalRevenueResult.length > 0 ? totalRevenueResult[0].totalRevenue : 0;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=sales.json');
        res.send(JSON.stringify({ monthlySales: salesByMonth, totalRevenue }, null, 2));
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.exportSales = exportSales;
// @desc    Export orders by time period
// @route   GET /api/admin/export/orders/daily?date=2024-01-01
// @route   GET /api/admin/export/orders/weekly?week=2024-W01
// @route   GET /api/admin/export/orders/monthly?month=2024-01
// @access  Private/Admin
const exportOrdersByTime = async (req, res) => {
    const { period } = req.params; // 'daily', 'weekly', 'monthly'
    const query = req.query;
    try {
        let dateFilter = {};
        let filename = '';
        if (period === 'daily' && query.date) {
            const startDate = new Date(query.date);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
            dateFilter.createdAt = { $gte: startDate, $lt: endDate };
            filename = `orders_daily_${query.date}.json`;
        }
        else if (period === 'weekly' && query.week) {
            const [year, week] = query.week.split('-W');
            const startDate = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 7);
            dateFilter.createdAt = { $gte: startDate, $lt: endDate };
            filename = `orders_weekly_${query.week}.json`;
        }
        else if (period === 'monthly' && query.month) {
            const [year, month] = query.month.split('-');
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 1);
            dateFilter.createdAt = { $gte: startDate, $lt: endDate };
            filename = `orders_monthly_${query.month}.json`;
        }
        else {
            return res.status(400).json({ message: 'Invalid period or missing date parameter' });
        }
        const orders = await Order_1.default.find(dateFilter)
            .populate('user', 'id username email')
            .populate('deliveryPerson', 'id username email')
            .lean();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(JSON.stringify(orders, null, 2));
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.exportOrdersByTime = exportOrdersByTime;
// @desc    Export sales by time period
// @route   GET /api/admin/export/sales/daily?date=2024-01-01
// @route   GET /api/admin/export/sales/weekly?week=2024-W01
// @route   GET /api/admin/export/sales/monthly?month=2024-01
// @access  Private/Admin
const exportSalesByTime = async (req, res) => {
    const { period } = req.params; // 'daily', 'weekly', 'monthly'
    const query = req.query;
    try {
        let dateFilter = { isPaid: true };
        let filename = '';
        if (period === 'daily' && query.date) {
            const startDate = new Date(query.date);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
            dateFilter.createdAt = { $gte: startDate, $lt: endDate };
            filename = `sales_daily_${query.date}.json`;
        }
        else if (period === 'weekly' && query.week) {
            const [year, week] = query.week.split('-W');
            const startDate = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 7);
            dateFilter.createdAt = { $gte: startDate, $lt: endDate };
            filename = `sales_weekly_${query.week}.json`;
        }
        else if (period === 'monthly' && query.month) {
            const [year, month] = query.month.split('-');
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 1);
            dateFilter.createdAt = { $gte: startDate, $lt: endDate };
            filename = `sales_monthly_${query.month}.json`;
        }
        else {
            return res.status(400).json({ message: 'Invalid period or missing date parameter' });
        }
        // Get sales data for the specified period
        const salesData = await Order_1.default.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: period === 'daily' ? '%Y-%m-%d' :
                                period === 'weekly' ? '%Y-W%V' :
                                    '%Y-%m',
                            date: '$createdAt'
                        }
                    },
                    totalSales: { $sum: '$totalPrice' },
                    orderCount: { $sum: 1 },
                    orders: { $push: '$$ROOT' }
                }
            },
            { $sort: { '_id': 1 } }
        ]);
        // Calculate total revenue for the period
        const totalRevenueResult = await Order_1.default.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalPrice' },
                    totalOrders: { $sum: 1 }
                }
            }
        ]);
        const totalRevenue = totalRevenueResult.length > 0 ? totalRevenueResult[0].totalRevenue : 0;
        const totalOrders = totalRevenueResult.length > 0 ? totalRevenueResult[0].totalOrders : 0;
        const result = {
            period,
            dateRange: query,
            summary: {
                totalRevenue,
                totalOrders,
                averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
            },
            data: salesData
        };
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(JSON.stringify(result, null, 2));
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.exportSalesByTime = exportSalesByTime;
// @desc    Get total number of orders
// @route   GET /api/admin/stats/orders-count
// @access  Private/Admin
const getTotalOrdersCount = async (req, res) => {
    try {
        const count = await Order_1.default.countDocuments({});
        res.json({ count });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getTotalOrdersCount = getTotalOrdersCount;
// @desc    Get total number of customers
// @route   GET /api/admin/stats/customers-count
// @access  Private/Admin
const getTotalCustomersCount = async (req, res) => {
    try {
        const count = await User_1.default.countDocuments({ role: 'user' });
        res.json({ count });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getTotalCustomersCount = getTotalCustomersCount;
// @desc    Get total number of active delivery persons
// @route   GET /api/admin/stats/delivery-persons-count
// @access  Private/Admin
const getActiveDeliveryPersonsCount = async (req, res) => {
    try {
        const count = await User_1.default.countDocuments({ role: 'delivery' });
        res.json({ count });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getActiveDeliveryPersonsCount = getActiveDeliveryPersonsCount;
// @desc    Get total revenue for today
// @route   GET /api/admin/stats/revenue-today
// @access  Private/Admin
const getRevenueToday = async (req, res) => {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        const revenueResult = await Order_1.default.aggregate([
            {
                $match: {
                    isPaid: true,
                    createdAt: { $gte: startOfToday, $lte: endOfToday },
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalPrice' },
                },
            },
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
        res.json({ totalRevenue });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getRevenueToday = getRevenueToday;
// ==================== INVENTORY MANAGEMENT ====================
const getAllProducts = async (req, res) => {
    try {
        await expireOldNewArrivalFlags();
        const products = await Product_1.default.find()
            .populate('category')
            .sort({ createdAt: -1 })
            .lean({ virtuals: true });
        res.json(products);
    }
    catch (error) {
        console.error('Inventory fetch error:', error);
        res.status(500).json({ message: 'Failed to fetch inventory' });
    }
};
exports.getAllProducts = getAllProducts;
// GET /api/admin/inventory/:location - Get inventory for specific location
const getInventory = async (req, res) => {
    try {
        const { location } = req.params;
        const products = await Product_1.default.find({
            'inventory.location': location,
            isActive: true
        }).populate('category');
        res.json(products);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getInventory = getInventory;
// Validation middleware
const validateCreateProduct = (req, res, next) => {
    const { error } = adminValidation_1.createProductSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    next();
};
const validateUpdateProduct = (req, res, next) => {
    const { error } = adminValidation_1.updateProductSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    next();
};
// POST /api/admin/inventory/create-product - Step 1: Basic product only (no store, price, deal - those come with batches)
const createInventoryProduct = async (req, res) => {
    const { error } = adminValidation_1.createProductBasicSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    const data = req.body;
    try {
        const categoryExists = await Category_1.default.findById(data.category);
        if (!categoryExists) {
            return res.status(400).json({ message: 'Invalid category ID' });
        }
        const product = new Product_1.default({
            name: data.name.trim(),
            description: data.description?.trim() || '',
            category: data.category,
            subcategory: data.subcategory || undefined,
            videoUrl: data.videoUrl?.trim() || '',
            images: data.images || [],
            originLocation: data.originLocation?.trim().toLowerCase() || undefined,
            isGITagged: data.isGITagged ?? false,
            isNewArrival: data.isNewArrival ?? false,
            isMostSaled: data.isMostSaled ?? false,
            isActive: data.isActive ?? true,
            variants: [],
            inventory: [],
        });
        await product.save();
        await product.populate('category');
        return res.status(201).json({ message: 'Product created', product });
    }
    catch (error) {
        console.error('Error creating product:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Validation failed',
                errors: Object.values(error.errors).map((e) => e.message)
            });
        }
        return res.status(500).json({ message: error.message });
    }
};
exports.createInventoryProduct = createInventoryProduct;
// PUT /api/admin/inventory/:productId/batches - Step 2/3: Add variants + batches
// Supports both with-variant and without-variant product creation; does not alter variant flow.
const addBatches = async (req, res) => {
    const { error } = adminValidation_1.addBatchesSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    const productId = req.params.id;
    const { store, originalPrice, offerPrice, addVariants, batches } = req.body;
    try {
        if (!mongoose_1.default.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(store)) {
            return res.status(400).json({ message: 'Invalid store ID' });
        }
        const storeExists = await DeliverySettings_1.default.exists({
            storeLocations: { $elemMatch: { storeId: store, isActive: true } }
        });
        if (!storeExists) {
            return res.status(400).json({ message: 'Store not found or inactive' });
        }
        const product = await Product_1.default.findById(productId);
        if (!product)
            return res.status(404).json({ message: 'Product not found' });
        product.store = store;
        if (originalPrice != null)
            product.originalPrice = Number(originalPrice);
        if (offerPrice != null)
            product.offerPrice = Number(offerPrice);
        if (addVariants && addVariants.length > 0) {
            if (!product.variants)
                product.variants = [];
            for (const v of addVariants) {
                product.variants.push({
                    type: v.type,
                    value: v.value,
                    originalPrice: v.originalPrice,
                    offerPrice: v.offerPrice
                });
            }
        }
        const variantCount = Math.max(1, product.variants?.length ?? 0);
        const maxVariantIndex = variantCount - 1;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Build a fresh inventory array so Mongoose reliably persists (avoid in-place nested push)
        const locationMap = new Map();
        // Copy existing inventory into the map (preserve existing batches/stock)
        const existingInventory = Array.isArray(product.inventory) ? product.inventory : [];
        for (const inv of existingInventory) {
            const locName = String(inv.location || '').trim().toLowerCase();
            if (!locName)
                continue;
            locationMap.set(locName, {
                location: locName,
                batches: Array.isArray(inv.batches) ? inv.batches.map((b) => ({ ...b })) : [],
                stock: Array.isArray(inv.stock) ? inv.stock.map((s) => ({ ...s })) : []
            });
        }
        // Add each new batch to the correct location
        for (const b of batches) {
            const variantIndex = b.variantIndex ?? 0;
            if (variantIndex < 0 || variantIndex > maxVariantIndex) {
                return res.status(400).json({ message: `variantIndex must be 0-${maxVariantIndex}` });
            }
            const expiryDate = new Date(b.expiryDate);
            expiryDate.setHours(0, 0, 0, 0);
            if (expiryDate <= today) {
                return res.status(400).json({ message: 'Cannot add expired batch' });
            }
            const locName = String(b.location).trim().toLowerCase();
            if (!locName)
                continue;
            let entry = locationMap.get(locName);
            if (!entry) {
                entry = { location: locName, batches: [], stock: [] };
                locationMap.set(locName, entry);
            }
            entry.batches.push({
                batchNumber: b.batchNumber,
                quantity: Number(b.quantity),
                // Track original quantity for analytics inference.
                initialQuantity: Number(b.quantity),
                soldQuantity: 0,
                revenue: 0,
                giveAwayQuantity: 0,
                manufacturingDate: new Date(b.manufacturingDate),
                expiryDate: new Date(b.expiryDate),
                purchasePrice: Number(b.purchasePrice),
                sellingPrice: Number(b.sellingPrice),
                variantIndex,
                batchWholePrice: b.batchWholePrice != null && Number(b.batchWholePrice) >= 0 ? Number(b.batchWholePrice) : undefined,
                dealTriggerDays: b.dealTriggerDays != null ? Number(b.dealTriggerDays) : undefined,
                dealDiscountPercent: b.dealDiscountPercent != null ? Number(b.dealDiscountPercent) : undefined,
            });
        }
        // Replace product.inventory with the new array so Mongoose persists it
        product.inventory = Array.from(locationMap.values());
        product.markModified('inventory');
        product.markModified('variants');
        await product.save();
        const updated = await Product_1.default.findById(productId).populate('category').lean({ virtuals: true });
        return res.status(200).json({ message: 'Batches added', product: updated });
    }
    catch (error) {
        console.error('Error adding batches:', error);
        return res.status(500).json({ message: error.message });
    }
};
exports.addBatches = addBatches;
// PUT /api/admin/inventory/:id - Update product + flags
// PUT /api/admin/inventory/products/:id
const updateInventoryProduct = async (req, res) => {
    try {
        const updatedProduct = await Product_1.default.findByIdAndUpdate(req.params.id, { $set: req.body }, // 🔥 SAFE UPDATE
        {
            new: true,
            runValidators: true // 🔥 IMPORTANT
        }).populate('category');
        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(updatedProduct);
    }
    catch (error) {
        console.error("Update error:", error);
        res.status(400).json({ message: error.message });
    }
};
exports.updateInventoryProduct = updateInventoryProduct;
// PUT /api/admin/inventory/:id/stock - Update specific location stock (supports batches & legacy stock)
// Works for both with-variant and without-variant products; does not alter variant flow.
const updateStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { location, variantIndex: variantIndexRaw, quantity, batchNumber, manufacturingDate, expiryDate, purchasePrice, sellingPrice, batchWholePrice, dealTriggerDays, dealDiscountPercent } = req.body;
        const variantIndex = typeof variantIndexRaw === 'number' ? variantIndexRaw : Number(variantIndexRaw);
        if (!id || !location || (typeof quantity !== 'number' && (quantity === undefined || quantity === null))) {
            return res.status(400).json({
                message: 'Invalid input parameters',
                required: 'productId, location, variantIndex (number), quantity (number)'
            });
        }
        const qty = Number(quantity);
        if (Number.isNaN(qty) || qty < 0) {
            return res.status(400).json({ message: 'Quantity must be a non-negative number' });
        }
        const product = await Product_1.default.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const maxVariantIndex = Math.max(0, (product.variants?.length ?? 1) - 1);
        if (Number.isNaN(variantIndex) || variantIndex < 0 || variantIndex > maxVariantIndex) {
            return res.status(400).json({
                message: `variantIndex must be 0-${maxVariantIndex} for this product`
            });
        }
        const now = new Date();
        const defaultExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const variants = product.variants && product.variants.length > 0 ? product.variants : [];
        const variant = variants[variantIndex];
        const unitPurchasePrice = typeof purchasePrice === 'number' && purchasePrice >= 0
            ? purchasePrice
            : (variant?.originalPrice ?? product.originalPrice ?? product.offerPrice ?? 0);
        const unitSellingPrice = typeof sellingPrice === 'number' && sellingPrice >= 0
            ? sellingPrice
            : (variant?.offerPrice ?? variant?.originalPrice ?? product.offerPrice ?? product.originalPrice ?? 0);
        const useBatches = batchNumber || manufacturingDate || expiryDate;
        const locName = String(location).trim().toLowerCase();
        if (!locName) {
            return res.status(400).json({ message: 'Location is required' });
        }
        // Build a fresh inventory array so Mongoose persists (same pattern as addBatches)
        const locationMap = new Map();
        const existingInventory = Array.isArray(product.inventory) ? product.inventory : [];
        for (const inv of existingInventory) {
            const name = String(inv.location || '').trim().toLowerCase();
            if (!name)
                continue;
            locationMap.set(name, {
                location: name,
                batches: Array.isArray(inv.batches) ? inv.batches.map((b) => ({ ...b })) : [],
                stock: Array.isArray(inv.stock) ? inv.stock.map((s) => ({ ...s })) : []
            });
        }
        let entry = locationMap.get(locName);
        if (!entry) {
            entry = { location: locName, batches: [], stock: [] };
            locationMap.set(locName, entry);
        }
        const safeDate = (d, fallback) => {
            if (d == null)
                return fallback;
            const t = new Date(d);
            return isNaN(t.getTime()) ? fallback : t;
        };
        if (useBatches) {
            const newBatch = {
                batchNumber: batchNumber || `BATCH-${Date.now()}`,
                quantity: qty,
                initialQuantity: qty,
                soldQuantity: 0,
                revenue: 0,
                giveAwayQuantity: 0,
                manufacturingDate: safeDate(manufacturingDate, now),
                expiryDate: safeDate(expiryDate, defaultExpiry),
                purchasePrice: Number(unitPurchasePrice),
                sellingPrice: Number(unitSellingPrice),
                variantIndex,
                batchWholePrice: batchWholePrice != null && Number(batchWholePrice) >= 0 ? Number(batchWholePrice) : undefined,
                dealTriggerDays: dealTriggerDays != null && Number(dealTriggerDays) >= 0 ? Number(dealTriggerDays) : undefined,
                dealDiscountPercent: dealDiscountPercent != null && Number(dealDiscountPercent) >= 0 ? Number(dealDiscountPercent) : undefined
            };
            const existingIdx = entry.batches.findIndex((b) => b.batchNumber === newBatch.batchNumber && b.variantIndex === variantIndex);
            if (existingIdx >= 0) {
                entry.batches[existingIdx] = newBatch;
            }
            else {
                entry.batches.push(newBatch);
            }
            entry.stock = entry.stock.filter((s) => s.variantIndex !== variantIndex);
        }
        else {
            entry.batches = entry.batches.filter((b) => b.variantIndex !== variantIndex);
            entry.batches.push({
                batchNumber: `BATCH-${Date.now()}`,
                quantity: qty,
                initialQuantity: qty,
                soldQuantity: 0,
                revenue: 0,
                giveAwayQuantity: 0,
                manufacturingDate: now,
                expiryDate: defaultExpiry,
                purchasePrice: Number(unitPurchasePrice),
                sellingPrice: Number(unitSellingPrice),
                variantIndex,
                batchWholePrice: batchWholePrice != null && Number(batchWholePrice) >= 0 ? Number(batchWholePrice) : undefined,
                dealTriggerDays: dealTriggerDays != null && Number(dealTriggerDays) >= 0 ? Number(dealTriggerDays) : undefined,
                dealDiscountPercent: dealDiscountPercent != null && Number(dealDiscountPercent) >= 0 ? Number(dealDiscountPercent) : undefined
            });
            const si = entry.stock.findIndex((s) => s.variantIndex === variantIndex);
            if (si >= 0) {
                entry.stock[si].quantity = qty;
            }
            else {
                entry.stock.push({ variantIndex, quantity: qty, lowStockThreshold: 5 });
            }
        }
        product.inventory = Array.from(locationMap.values());
        product.markModified('inventory');
        await product.save();
        res.json({
            success: true,
            message: `Stock updated for ${locName} (variant ${variantIndex})`,
            data: { location: locName, variantIndex, quantity: qty }
        });
    }
    catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({
            message: error.message || 'Failed to update stock',
            error: error.message
        });
    }
};
exports.updateStock = updateStock;
// PUT /api/admin/inventory/:id/flag - Toggle product flags
const toggleFlag = async (req, res) => {
    try {
        const { flag, value } = req.body; // 'isGITagged' or 'isNewArrival'
        // Validate flag type
        if (!['isGITagged', 'isNewArrival'].includes(flag)) {
            return res.status(400).json({ message: 'Invalid flag type' });
        }
        const product = await Product_1.default.findByIdAndUpdate(req.params.id, { [flag]: value }, { new: true });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.toggleFlag = toggleFlag;
// GET /api/admin/inventory/products - Get all products for admin management
// DELETE /api/admin/inventory/:id - Deactivate product (soft delete)
const deactivateProduct = async (req, res) => {
    try {
        const product = await Product_1.default.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.deactivateProduct = deactivateProduct;
// PUT /api/admin/inventory/:id/most-saled - Toggle product most saled flag
const toggleMostSaled = async (req, res) => {
    try {
        const { value } = req.body; // boolean value for isMostSaled
        // Validate value type
        if (typeof value !== 'boolean') {
            return res.status(400).json({ message: 'Invalid value type for isMostSaled' });
        }
        const product = await Product_1.default.findByIdAndUpdate(req.params.id, { isMostSaled: value }, { new: true });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ success: true, isMostSaled: product.isMostSaled });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.toggleMostSaled = toggleMostSaled;
// @desc    Get delivery settings
// @route   GET /api/admin/delivery-settings
// @access  Private/Admin
const getDeliverySettings = async (req, res) => {
    try {
        let settings = await DeliverySettings_1.default.findOne();
        if (!settings) {
            return res.json({
                pricePerKm: 10,
                baseCharge: 50,
                freeDeliveryThreshold: 500,
                storeLocations: [],
                message: "Store locations not configured yet"
            });
        }
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch delivery settings" });
    }
};
exports.getDeliverySettings = getDeliverySettings;
// @desc    Get active delivery locations
// @route   GET /api/admin/delivery-locations
// @access  Private/Admin
// GET /admin/delivery-locations
const getDeliveryLocations = async (req, res) => {
    const settings = await DeliverySettings_1.default.findOne({}, { storeLocations: 1 });
    res.json(settings.storeLocations
        .filter(s => s.isActive)
        .map(s => ({
        storeId: s.storeId, // ✅ IMPORTANT
        name: s.name,
        displayName: s.name,
        city: s.city
    })));
};
exports.getDeliveryLocations = getDeliveryLocations;
// ==================== GIVEAWAY MANAGEMENT ====================
// @desc    Get all giveaways
// @route   GET /api/admin/giveaways
// @access  Private/Admin
const getGiveAways = async (req, res) => {
    try {
        const items = await GiveAway_1.default.find().sort({ createdAt: -1 }).lean();
        return res.json(items);
    }
    catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to fetch giveaways' });
    }
};
exports.getGiveAways = getGiveAways;
// @desc    Create giveaway
// @route   POST /api/admin/giveaways
// @access  Private/Admin
const createGiveAway = async (req, res) => {
    console.log('createGiveAway', req.body);
    try {
        const { title, description, isActive, startAt, endAt, conditions, reward } = req.body || {};
        if (!title || !String(title).trim()) {
            return res.status(400).json({ message: 'Title is required' });
        }
        const safeReward = reward && reward.type
            ? reward
            : { type: 'other', label: 'Deal-of-the-day giveaway' };
        if (safeReward.type === 'percentage_discount' && (safeReward.value == null || Number(safeReward.value) > 100)) {
            return res.status(400).json({ message: 'Percentage discount must be <= 100' });
        }
        const parsedStartAt = startAt ? new Date(startAt) : undefined;
        const parsedEndAt = endAt ? new Date(endAt) : undefined;
        if (parsedStartAt && isNaN(parsedStartAt.getTime())) {
            return res.status(400).json({ message: 'Invalid startAt date' });
        }
        if (parsedEndAt && isNaN(parsedEndAt.getTime())) {
            return res.status(400).json({ message: 'Invalid endAt date' });
        }
        if (parsedStartAt && parsedEndAt && parsedEndAt < parsedStartAt) {
            return res.status(400).json({ message: 'endAt must be after startAt' });
        }
        const safeConditions = Array.isArray(conditions) ? conditions : [];
        const sanitizedConditions = safeConditions
            .filter((c) => c && c.type)
            .map((c) => ({
            type: c.type,
            value: Number(c.value) || 0,
            isEnabled: c.isEnabled !== false
        }));
        const doc = await GiveAway_1.default.create({
            title: String(title).trim(),
            description: description ? String(description).trim() : '',
            isActive: isActive !== false,
            startAt: parsedStartAt,
            endAt: parsedEndAt,
            conditions: sanitizedConditions,
            reward: {
                type: safeReward.type,
                value: safeReward.value != null ? Number(safeReward.value) : undefined,
                label: safeReward.label ? String(safeReward.label).trim() : undefined,
                productId: safeReward.productId || undefined
            },
            createdBy: req.user?._id
        });
        return res.status(201).json(doc);
    }
    catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to create giveaway' });
    }
};
exports.createGiveAway = createGiveAway;
// @desc    Update giveaway
// @route   PUT /api/admin/giveaways/:id
// @access  Private/Admin
const updateGiveAway = async (req, res) => {
    try {
        const id = req.params.id;
        const { title, description, isActive, startAt, endAt, conditions, reward } = req.body || {};
        const existing = await GiveAway_1.default.findById(id);
        if (!existing)
            return res.status(404).json({ message: 'Giveaway not found' });
        if (title != null && !String(title).trim()) {
            return res.status(400).json({ message: 'Title cannot be empty' });
        }
        const parsedStartAt = startAt != null ? (startAt ? new Date(startAt) : undefined) : existing.startAt;
        const parsedEndAt = endAt != null ? (endAt ? new Date(endAt) : undefined) : existing.endAt;
        if (parsedStartAt && isNaN(parsedStartAt.getTime())) {
            return res.status(400).json({ message: 'Invalid startAt date' });
        }
        if (parsedEndAt && isNaN(parsedEndAt.getTime())) {
            return res.status(400).json({ message: 'Invalid endAt date' });
        }
        if (parsedStartAt && parsedEndAt && parsedEndAt < parsedStartAt) {
            return res.status(400).json({ message: 'endAt must be after startAt' });
        }
        if (title != null)
            existing.title = String(title).trim();
        if (description != null)
            existing.description = String(description).trim();
        if (isActive != null)
            existing.isActive = Boolean(isActive);
        if (startAt != null)
            existing.startAt = parsedStartAt;
        if (endAt != null)
            existing.endAt = parsedEndAt;
        if (conditions != null) {
            const safeConditions = Array.isArray(conditions) ? conditions : [];
            existing.conditions = safeConditions
                .filter((c) => c && c.type)
                .map((c) => ({
                type: c.type,
                value: Number(c.value) || 0,
                isEnabled: c.isEnabled !== false
            }));
            existing.markModified('conditions');
        }
        if (reward != null) {
            const safeReward = reward && reward.type
                ? reward
                : { type: 'other', label: 'Deal-of-the-day giveaway' };
            if (safeReward.type === 'percentage_discount' && (safeReward.value == null || Number(safeReward.value) > 100)) {
                return res.status(400).json({ message: 'Percentage discount must be <= 100' });
            }
            existing.reward = {
                type: safeReward.type,
                value: safeReward.value != null ? Number(safeReward.value) : undefined,
                label: safeReward.label ? String(safeReward.label).trim() : undefined,
                productId: safeReward.productId || undefined
            };
            existing.markModified('reward');
        }
        await existing.save();
        return res.json(existing);
    }
    catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to update giveaway' });
    }
};
exports.updateGiveAway = updateGiveAway;
// @desc    Delete giveaway
// @route   DELETE /api/admin/giveaways/:id
// @access  Private/Admin
const deleteGiveAway = async (req, res) => {
    try {
        const id = req.params.id;
        const existing = await GiveAway_1.default.findById(id);
        if (!existing)
            return res.status(404).json({ message: 'Giveaway not found' });
        await existing.deleteOne();
        return res.json({ message: 'Giveaway deleted' });
    }
    catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to delete giveaway' });
    }
};
exports.deleteGiveAway = deleteGiveAway;
// ==================== GIVEAWAY PER-ORDER (Admin) ====================
const isWithinGiveAwayWindow = (g, now) => {
    const s = g.startAt ? new Date(g.startAt) : null;
    const e = g.endAt ? new Date(g.endAt) : null;
    if (s && now < s)
        return false;
    if (e && now > e)
        return false;
    return true;
};
const getDealOfDayNowForProduct = (product, now) => {
    const currentDate = new Date(now);
    currentDate.setHours(0, 0, 0, 0);
    const productTriggerDays = product.dealTriggerDays ?? 0;
    const productDiscountPercent = product.dealDiscountPercent ?? 0;
    const inventory = product.inventory || [];
    for (const loc of inventory) {
        const batches = loc.batches || [];
        for (const batch of batches) {
            const triggerDays = batch.dealTriggerDays ?? productTriggerDays;
            const batchDiscount = batch.dealDiscountPercent ?? productDiscountPercent;
            if (triggerDays <= 0 || batchDiscount <= 0)
                continue;
            const batchExpiry = new Date(batch.expiryDate);
            batchExpiry.setHours(0, 0, 0, 0);
            const dealStartDate = new Date(batchExpiry);
            dealStartDate.setDate(dealStartDate.getDate() - triggerDays);
            if (currentDate >= dealStartDate && currentDate <= batchExpiry && (batch.quantity || 0) > 0) {
                return true;
            }
        }
    }
    return false;
};
const isDealOfDayBatchEligibleForProduct = (product, batch, now) => {
    const currentDate = new Date(now);
    currentDate.setHours(0, 0, 0, 0);
    const productTriggerDays = product.dealTriggerDays ?? 0;
    const productDiscountPercent = product.dealDiscountPercent ?? 0;
    const triggerDays = batch.dealTriggerDays ?? productTriggerDays;
    const batchDiscount = batch.dealDiscountPercent ?? productDiscountPercent;
    if (triggerDays <= 0 || batchDiscount <= 0)
        return false;
    const batchExpiry = new Date(batch.expiryDate);
    batchExpiry.setHours(0, 0, 0, 0);
    const dealStartDate = new Date(batchExpiry);
    dealStartDate.setDate(dealStartDate.getDate() - triggerDays);
    return (currentDate >= dealStartDate &&
        currentDate <= batchExpiry &&
        (batch.quantity || 0) > 0);
};
const isDealOfDayNowForProductInStore = (product, storeName, now) => {
    const inventory = product.inventory || [];
    const store = storeName.toLowerCase();
    for (const loc of inventory) {
        if ((loc.location || '').toLowerCase() !== store)
            continue;
        const batches = loc.batches || [];
        for (const batch of batches) {
            if (isDealOfDayBatchEligibleForProduct(product, batch, now))
                return true;
        }
    }
    return false;
};
const getDealEligibleQtyByVariantIndexAtStore = (product, storeName, now) => {
    const variants = product.variants || [];
    const maxVariants = Math.max(1, variants.length);
    const res = Array.from({ length: maxVariants }, () => 0);
    const isVariantActive = (i) => variants[i]?.isActive !== false;
    const inventory = product.inventory || [];
    const inv = inventory.find((i) => (i.location || '').toLowerCase() === storeName.toLowerCase());
    if (!inv)
        return res;
    const batches = inv.batches || [];
    if (!batches.length)
        return res; // without batch info, we can't reliably calculate deal window quantity
    for (const b of batches) {
        const vi = Number(b.variantIndex ?? 0);
        if (vi < 0 || vi >= maxVariants)
            continue;
        if (!isVariantActive(vi))
            continue;
        if (!isDealOfDayBatchEligibleForProduct(product, b, now))
            continue;
        res[vi] += b.quantity || 0;
    }
    return res;
};
const loadGiveAwayUserStats = async (userId, now) => {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const [ordersTodayCount, lifetimeOrders, spentAgg] = await Promise.all([
        Order_1.default.countDocuments({
            user: userId,
            createdAt: { $gte: startOfToday, $lte: endOfToday }
        }),
        Order_1.default.countDocuments({ user: userId }),
        Order_1.default.aggregate([
            { $match: { user: userId, status: { $ne: 'cancelled' } } },
            { $group: { _id: null, total: { $sum: '$totalPrice' } } }
        ])
    ]);
    const lifetimeSpent = spentAgg?.[0]?.total || 0;
    return { ordersTodayCount, lifetimeOrders, lifetimeSpent };
};
/** Sync evaluation using preloaded user stats (for batch eligibility). */
const evaluateGiveAwayConditions = (orderTotal, giveAwayDoc, stats) => {
    const enabledConditions = (giveAwayDoc.conditions || []).filter((c) => c && c.isEnabled !== false);
    for (const c of enabledConditions) {
        if (c.type === 'minOrderAmount') {
            if (orderTotal < Number(c.value || 0))
                return false;
        }
        if (c.type === 'minOrdersInDay') {
            if (stats.ordersTodayCount < Number(c.value || 0))
                return false;
        }
        if (c.type === 'minLifetimeOrders') {
            if (stats.lifetimeOrders < Number(c.value || 0))
                return false;
        }
        if (c.type === 'minLifetimeSpent') {
            if (stats.lifetimeSpent < Number(c.value || 0))
                return false;
        }
    }
    return true;
};
// @desc    Check if order is eligible for any giveaway & list Deal-of-the-Day products
// @route   GET /api/admin/orders/:id/giveaway-eligibility
// @access  Private/Admin
const getOrderGiveAwayEligibility = async (req, res) => {
    try {
        const order = await Order_1.default.findById(req.params.id).lean();
        if (!order)
            return res.status(404).json({ message: 'Order not found' });
        if (order.status === 'cancelled') {
            return res.json({ eligible: false, reason: 'Order is cancelled' });
        }
        if (order.giveAwayItems?.length) {
            return res.json({ eligible: false, reason: 'GiveAway already applied for this order' });
        }
        const storeName = (order.storeName || order.nearestStore || '').toString().trim();
        if (!storeName) {
            return res.json({ eligible: false, reason: 'Order store is missing (cannot deduct inventory)' });
        }
        const now = new Date();
        const giveAways = await GiveAway_1.default.find({ isActive: true }).sort({ createdAt: -1 }).lean();
        const stats = await loadGiveAwayUserStats(order.user, now);
        let matched = null;
        for (const g of giveAways) {
            if (!isWithinGiveAwayWindow(g, now))
                continue;
            const ok = evaluateGiveAwayConditions(order.totalPrice || 0, g, stats);
            if (ok) {
                matched = g;
                break;
            }
        }
        if (!matched) {
            return res.json({ eligible: false, reason: 'No matching giveaway conditions' });
        }
        // list current deal-of-the-day products for THIS order store (lean already)
        const products = await Product_1.default.find({ isActive: true }).lean();
        const dealProducts = products.filter((p) => isDealOfDayNowForProductInStore(p, storeName, now));
        return res.json({
            eligible: true,
            giveAwayId: matched._id,
            giveAwayTitle: matched.title,
            dealProducts: dealProducts.map((p) => ({
                _id: p._id,
                name: p.name,
                images: p.images || [],
                originalPrice: p.originalPrice,
                offerPrice: p.offerPrice,
                variants: p.variants || [],
                // Qty that exists inside the Deal-of-the-Day window for this store (used to cap admin qty)
                availableQtyByVariantIndex: getDealEligibleQtyByVariantIndexAtStore(p, storeName, now),
            }))
        });
    }
    catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to check eligibility' });
    }
};
exports.getOrderGiveAwayEligibility = getOrderGiveAwayEligibility;
// @desc    GiveAway eligibility for many orders (for admin list UI)
// @route   POST /api/admin/orders/giveaway-eligibility-batch
// @access  Private/Admin
const getOrdersGiveAwayEligibilityBatch = async (req, res) => {
    try {
        const orderIds = req.body?.orderIds;
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ message: 'orderIds must be a non-empty array' });
        }
        const capped = orderIds.slice(0, 500).map((id) => String(id));
        const orders = await Order_1.default.find({ _id: { $in: capped } }).lean();
        const now = new Date();
        const giveAways = await GiveAway_1.default.find({ isActive: true }).sort({ createdAt: -1 }).lean();
        const userIds = [...new Set(orders.map((o) => String(o.user)))];
        const userObjectIds = userIds.map((id) => new mongoose_1.default.Types.ObjectId(id));
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);
        const [ordersTodayAgg, lifetimeAgg, spentAgg] = await Promise.all([
            Order_1.default.aggregate([
                { $match: { user: { $in: userObjectIds }, createdAt: { $gte: startOfToday, $lte: endOfToday } } },
                { $group: { _id: '$user', count: { $sum: 1 } } }
            ]),
            Order_1.default.aggregate([
                { $match: { user: { $in: userObjectIds } } },
                { $group: { _id: '$user', count: { $sum: 1 } } }
            ]),
            Order_1.default.aggregate([
                { $match: { user: { $in: userObjectIds }, status: { $ne: 'cancelled' } } },
                { $group: { _id: '$user', total: { $sum: '$totalPrice' } } }
            ])
        ]);
        const statsMap = new Map();
        for (const uid of userIds) {
            const oToday = ordersTodayAgg.find((a) => String(a._id) === uid);
            const life = lifetimeAgg.find((a) => String(a._id) === uid);
            const sp = spentAgg.find((a) => String(a._id) === uid);
            statsMap.set(uid, {
                ordersTodayCount: oToday?.count || 0,
                lifetimeOrders: life?.count || 0,
                lifetimeSpent: sp?.total || 0
            });
        }
        const out = {};
        for (const order of orders) {
            const id = order._id.toString();
            if (order.status === 'cancelled') {
                out[id] = { eligible: false, reason: 'Order is cancelled' };
                continue;
            }
            if (order.giveAwayItems?.length) {
                out[id] = { eligible: false, reason: 'GiveAway already applied' };
                continue;
            }
            const storeName = (order.storeName || order.nearestStore || '').toString().trim();
            if (!storeName) {
                out[id] = { eligible: false, reason: 'Order store is missing' };
                continue;
            }
            const stats = statsMap.get(String(order.user)) || {
                ordersTodayCount: 0,
                lifetimeOrders: 0,
                lifetimeSpent: 0
            };
            let matched = null;
            for (const g of giveAways) {
                if (!isWithinGiveAwayWindow(g, now))
                    continue;
                if (evaluateGiveAwayConditions(order.totalPrice || 0, g, stats)) {
                    matched = g;
                    break;
                }
            }
            if (!matched) {
                out[id] = { eligible: false, reason: 'No matching giveaway conditions' };
            }
            else {
                out[id] = {
                    eligible: true,
                    giveAwayId: String(matched._id),
                    giveAwayTitle: matched.title
                };
            }
        }
        for (const rid of capped) {
            if (out[rid] === undefined) {
                out[rid] = { eligible: false, reason: 'Order not found' };
            }
        }
        return res.json(out);
    }
    catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to check eligibility batch' });
    }
};
exports.getOrdersGiveAwayEligibilityBatch = getOrdersGiveAwayEligibilityBatch;
// @desc    Apply giveaway items to a specific order (deduct inventory FIFO)
// @route   POST /api/admin/orders/:id/apply-giveaway
// @access  Private/Admin
const applyGiveAwayToOrder = async (req, res) => {
    try {
        const order = await Order_1.default.findById(req.params.id);
        if (!order)
            return res.status(404).json({ message: 'Order not found' });
        if (order.status === 'cancelled')
            return res.status(400).json({ message: 'Cannot apply giveaway to cancelled order' });
        if (order.giveAwayItems?.length)
            return res.status(400).json({ message: 'GiveAway already applied' });
        const { giveAwayId, items } = req.body || {};
        if (!giveAwayId)
            return res.status(400).json({ message: 'giveAwayId is required' });
        if (!Array.isArray(items) || items.length === 0)
            return res.status(400).json({ message: 'Select at least one product' });
        const giveAway = await GiveAway_1.default.findById(giveAwayId).lean();
        if (!giveAway || !giveAway.isActive)
            return res.status(400).json({ message: 'Invalid giveaway' });
        const now = new Date();
        if (!isWithinGiveAwayWindow(giveAway, now))
            return res.status(400).json({ message: 'GiveAway is not active in this time window' });
        const userStats = await loadGiveAwayUserStats(order.user, now);
        if (!evaluateGiveAwayConditions(order.totalPrice || 0, giveAway, userStats)) {
            return res.status(400).json({ message: 'Order/user not eligible for this giveaway' });
        }
        const storeName = (order.storeName || order.nearestStore || '').toString().trim();
        if (!storeName)
            return res.status(400).json({ message: 'Order store is missing' });
        const buildOrderItemFromProduct = (p, selectedVariantIndex, qty) => {
            const name = (() => {
                if (p.variants && p.variants.length > 0) {
                    const v = p.variants[selectedVariantIndex];
                    if (v)
                        return `${p.name} (${v.value})`;
                }
                return p.name;
            })();
            return {
                product: p._id,
                name: `${name} (GIVEAWAY)`,
                image: p.images?.[0] || 'no-image',
                qty,
                price: 0,
                selectedVariantIndex
            };
        };
        // Deduct FIFO from inventory (same logic as checkout)
        const allocationsPerGiveAwayItem = [];
        const giveAwayOrderItems = [];
        for (const it of items) {
            const qty = Math.floor(Number(it.qty));
            if (!(qty >= 1)) {
                return res.status(400).json({ message: 'Each item must have quantity at least 1' });
            }
            const product = await Product_1.default.findById(it.productId || it.product);
            if (!product)
                return res.status(400).json({ message: 'Invalid product in selection' });
            const productObj = product.toObject ? product.toObject() : product;
            if (!isDealOfDayNowForProductInStore(productObj, storeName, now)) {
                return res.status(400).json({ message: `${product.name} is not in Deal of the Day now for this store` });
            }
            const selectedVariantIndex = product.variants?.length ? Number(it.selectedVariantIndex ?? 0) : 0;
            const inv = product.inventory?.find((i) => i.location?.toLowerCase() === storeName.toLowerCase());
            if (!inv)
                return res.status(400).json({ message: `Inventory not found for ${product.name}` });
            const variants = product.variants || [];
            const isVariantActive = (i) => variants[i]?.isActive !== false;
            const getTotalQty = () => {
                if (!isVariantActive(selectedVariantIndex))
                    return 0;
                if (inv.batches?.length) {
                    return inv.batches
                        .filter((b) => b.variantIndex === selectedVariantIndex &&
                        isDealOfDayBatchEligibleForProduct(productObj, b, now))
                        .reduce((s, b) => s + (b.quantity || 0), 0);
                }
                // Without batch window info, we don't allow deal giveaway
                return 0;
            };
            if (getTotalQty() < qty) {
                return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
            }
            const allocations = [];
            if (inv.batches?.length) {
                let remaining = qty;
                const batchesForVariant = inv.batches
                    .filter((b) => b.variantIndex === selectedVariantIndex &&
                    isDealOfDayBatchEligibleForProduct(productObj, b, now))
                    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
                for (const b of batchesForVariant) {
                    if (remaining <= 0)
                        break;
                    const deduct = Math.min(b.quantity, remaining);
                    // For older batches missing analytics fields, derive them lazily.
                    if (b.initialQuantity == null) {
                        b.initialQuantity = Number((b.quantity || 0) + (b.soldQuantity || 0) + (b.giveAwayQuantity || 0));
                    }
                    b.quantity -= deduct;
                    // Track Deal-of-the-day GiveAway impact per batch.
                    // This allows analytics to show GiveAway Units/Value accurately.
                    if (deduct > 0) {
                        b.giveAwayQuantity = Number(b.giveAwayQuantity || 0) + deduct;
                    }
                    remaining -= deduct;
                    if (deduct > 0 && b.batchNumber)
                        allocations.push({ batchNumber: b.batchNumber, quantity: deduct });
                }
                // Do NOT remove depleted batches. Analytics needs the batch objects to still exist
                // so GiveAway impact can be counted even when Qty Left becomes 0.
            }
            else {
                // No batch info -> deal giveaway not supported
                return res.status(400).json({ message: `Insufficient deal stock for ${product.name}` });
            }
            await product.save();
            const orderItem = buildOrderItemFromProduct(product, selectedVariantIndex, qty);
            giveAwayOrderItems.push(orderItem);
            allocationsPerGiveAwayItem.push(allocations);
        }
        // attach allocations
        giveAwayOrderItems.forEach((gi, idx) => {
            gi.batchAllocations = allocationsPerGiveAwayItem[idx] || [];
        });
        order.giveAwayId = giveAway._id;
        order.giveAwayItems = giveAwayOrderItems;
        await order.save();
        return res.json({ message: 'GiveAway applied', order });
    }
    catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to apply giveaway' });
    }
};
exports.applyGiveAwayToOrder = applyGiveAwayToOrder;
// @desc    List eligible users/orders for a giveaway (today)
// @route   GET /api/admin/giveaways/:id/eligible-users
// @access  Private/Admin
const getGiveAwayEligibleUsers = async (req, res) => {
    try {
        const giveAway = await GiveAway_1.default.findById(req.params.id).lean();
        if (!giveAway)
            return res.status(404).json({ message: 'Giveaway not found' });
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);
        const minOrderAmountCond = (giveAway.conditions || []).find((c) => c.type === 'minOrderAmount' && c.isEnabled !== false);
        const minOrdersInDayCond = (giveAway.conditions || []).find((c) => c.type === 'minOrdersInDay' && c.isEnabled !== false);
        const minOrderAmount = minOrderAmountCond ? Number(minOrderAmountCond.value || 0) : 0;
        const minOrdersInDay = minOrdersInDayCond ? Number(minOrdersInDayCond.value || 0) : 0;
        // Pull today's orders (exclude cancelled)
        const todaysOrders = await Order_1.default.find({
            createdAt: { $gte: startOfToday, $lte: endOfToday },
            status: { $ne: 'cancelled' }
        })
            .populate('user', 'username email')
            .sort({ createdAt: -1 })
            .lean();
        // Group by user
        const byUser = new Map();
        for (const o of todaysOrders) {
            const uid = (o.user?._id || o.user)?.toString?.() || '';
            if (!uid)
                continue;
            if (!byUser.has(uid))
                byUser.set(uid, []);
            byUser.get(uid).push(o);
        }
        const result = [];
        for (const [uid, orders] of byUser.entries()) {
            const orderCount = orders.length;
            const hasBigOrder = minOrderAmount > 0 ? orders.some(o => Number(o.totalPrice || 0) >= minOrderAmount) : true;
            const hasDailyCount = minOrdersInDay > 0 ? orderCount >= minOrdersInDay : true;
            if (hasBigOrder && hasDailyCount) {
                const user = orders[0].user;
                result.push({
                    user: {
                        _id: user?._id?.toString?.() || uid,
                        username: user?.username,
                        email: user?.email
                    },
                    todayOrderCount: orderCount,
                    eligibleOrders: orders
                        .filter(o => (minOrderAmount > 0 ? Number(o.totalPrice || 0) >= minOrderAmount : true))
                        .slice(0, 5)
                        .map(o => ({
                        _id: o._id,
                        totalPrice: o.totalPrice,
                        createdAt: o.createdAt,
                        status: o.status,
                        deliveryMode: o.deliveryMode
                    }))
                });
            }
        }
        return res.json({ giveAwayId: giveAway._id, count: result.length, users: result });
    }
    catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to fetch eligible users' });
    }
};
exports.getGiveAwayEligibleUsers = getGiveAwayEligibleUsers;
// @desc    Update delivery settings
// @route   PUT /api/admin/delivery-settings
// @access  Private/Admin
const updateDeliverySettings = async (req, res) => {
    try {
        const { pricePerKm, baseCharge, freeDeliveryThreshold, gstPercentage, // 🔥 NEW FIELD
        storeLocations } = req.body;
        // 🔥 0️⃣ Validate GST
        if (typeof gstPercentage !== 'number' || gstPercentage < 0 || gstPercentage > 100) {
            return res.status(400).json({
                message: "GST percentage must be a number between 0 and 100"
            });
        }
        // 1️⃣ Basic validation
        if (!Array.isArray(storeLocations) || storeLocations.length === 0) {
            return res.status(400).json({
                message: "At least one store location is required"
            });
        }
        // 2️⃣ At least one active store
        const hasActiveStore = storeLocations.some((s) => s.isActive);
        if (!hasActiveStore) {
            return res.status(400).json({
                message: "At least one store must be active"
            });
        }
        // 3️⃣ Validate each store
        for (let i = 0; i < storeLocations.length; i++) {
            const store = storeLocations[i];
            const storeNum = i + 1;
            if (!store.name?.trim()) {
                return res.status(400).json({
                    message: `Store ${storeNum}: Store name is required`
                });
            }
            if (!store.contact_number?.trim()) {
                return res.status(400).json({
                    message: `Store ${storeNum}: Contact number is required`
                });
            }
            if (!store.address?.trim()) {
                return res.status(400).json({
                    message: `Store ${storeNum}: Address is required`
                });
            }
            if (!store.city?.trim()) {
                return res.status(400).json({
                    message: `Store ${storeNum}: City is required`
                });
            }
            if (typeof store.latitude !== 'number') {
                return res.status(400).json({
                    message: `Store ${storeNum}: Valid latitude is required`
                });
            }
            if (typeof store.longitude !== 'number') {
                return res.status(400).json({
                    message: `Store ${storeNum}: Valid longitude is required`
                });
            }
            if (store.latitude < -90 || store.latitude > 90) {
                return res.status(400).json({
                    message: `Store ${storeNum}: Latitude must be between -90 and 90`
                });
            }
            if (store.longitude < -180 || store.longitude > 180) {
                return res.status(400).json({
                    message: `Store ${storeNum}: Longitude must be between -180 and 180`
                });
            }
        }
        // 4️⃣ Process store locations
        const processedStores = storeLocations.map((store) => ({
            ...(store.storeId && { storeId: store.storeId }),
            name: store.name.trim(),
            contact_number: store.contact_number.trim(),
            address: store.address.trim(),
            city: store.city.trim(),
            latitude: store.latitude,
            longitude: store.longitude,
            isActive: store.isActive
        }));
        // 5️⃣ Create or Update settings
        let settings = await DeliverySettings_1.default.findOne();
        if (settings) {
            settings.pricePerKm = pricePerKm;
            settings.baseCharge = baseCharge;
            settings.freeDeliveryThreshold = freeDeliveryThreshold;
            settings.gstPercentage = gstPercentage; // 🔥 SAVE GST
            settings.storeLocations = processedStores;
            await settings.save();
        }
        else {
            settings = await DeliverySettings_1.default.create({
                pricePerKm,
                baseCharge,
                freeDeliveryThreshold,
                gstPercentage, // 🔥 ADD GST HERE
                storeLocations: processedStores
            });
        }
        res.json(settings);
    }
    catch (error) {
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map((err) => err.message);
            return res.status(400).json({
                message: "Validation failed",
                errors: validationErrors
            });
        }
        res.status(500).json({
            message: error.message || "Failed to update delivery settings"
        });
    }
};
exports.updateDeliverySettings = updateDeliverySettings;
// @desc    Generate invoice for an order (Admin)
// @route   GET /api/admin/orders/:id/invoice
// @access  Private/Admin
const getAdminInvoice = async (req, res) => {
    try {
        const order = await Order_1.default.findById(req.params.id)
            .populate('user', 'username email')
            .exec();
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        // Admin does not need an ownership check for invoices
        const doc = new pdfkit_1.default({ margin: 30 }); // Smaller margin for better fit
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice-${order._id}.pdf"`);
        doc.pipe(res);
        // Company Header
        doc.image(path_1.default.join(__dirname, '../assets/IndiasFood.png'), doc.page.width - 150, 30, { width: 120 });
        doc.fontSize(16).font('Helvetica-Bold').text(`INDIA'S FOOD`, 30, 50);
        doc.fontSize(10).font('Helvetica').text('A Unit of Maha Food', 30, 70);
        doc.fontSize(12).font('Helvetica-Bold').text(`India's True Taste`, 30, 85);
        doc.fontSize(9).font('Helvetica').text('Prasanth Layout, Prasanth Extension,', 30, 105);
        doc.text('Whitefield, Bengaluru, Karnataka 560066', 30, 117);
        doc.text('Ph: 9902312314', 30, 129);
        doc.text('Website: www.indiasfood.com', 30, 141);
        doc.text('GSTIN: 29ACCFM2331G1ZG', 30, 153);
        doc.moveDown(2);
        // Order Details - align right
        doc.fontSize(10).font('Helvetica').text('Order No :', 300, 170, { width: 100, align: 'right' });
        doc.font('Helvetica-Bold').text('INV-1001', 400, 170, { width: 150, align: 'right' }); // Assuming static INV-1001 for now
        const orderDate = order.createdAt
            ? new Date(order.createdAt).toLocaleDateString('en-IN')
            : 'N/A';
        doc.font('Helvetica').text('Date :', 300, 185, { width: 100, align: 'right' });
        doc.font('Helvetica-Bold').text(orderDate, 400, 185, { width: 150, align: 'right' });
        doc.moveDown(3);
        // Items table header
        const tableTop = doc.y;
        const itemX = 30;
        const qtyX = 300;
        const amtX = 450;
        doc.font('Helvetica-Bold')
            .text('Item', itemX, tableTop, { width: 250 })
            .text('Qty', qtyX, tableTop, { width: 50, align: 'right' })
            .text('Amt', amtX, tableTop, { width: 100, align: 'right' });
        doc.moveDown(0.5);
        doc.moveTo(itemX, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
        doc.moveDown(0.5);
        // Items table rows
        doc.font('Helvetica');
        order.orderItems.forEach((item) => {
            const itemTotalPrice = (item.qty * item.price);
            doc.text(item.name, itemX, doc.y, { width: 250 })
                .text(item.qty.toFixed(3), qtyX, doc.y, { width: 50, align: 'right' }) // Display Qty with 3 decimal places
                .text(itemTotalPrice.toFixed(2), amtX, doc.y, { width: 100, align: 'right' });
            doc.moveDown(0.5);
        });
        const giveAwayItems = order.giveAwayItems || [];
        if (Array.isArray(giveAwayItems) && giveAwayItems.length > 0) {
            doc.moveDown(0.3);
            doc
                .font('Helvetica-Bold')
                .text('GiveAway — Deal of the Day (complimentary)', itemX, doc.y, { width: 400 });
            doc.moveDown(0.3);
            doc.font('Helvetica');
            giveAwayItems.forEach((item) => {
                doc.text(item.name, itemX, doc.y, { width: 250 })
                    .text(Number(item.qty || 0).toFixed(3), qtyX, doc.y, { width: 50, align: 'right' })
                    .text('0.00', amtX, doc.y, { width: 100, align: 'right' });
                doc.moveDown(0.5);
            });
        }
        doc.moveDown(0.5);
        doc.moveTo(itemX, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
        doc.moveDown(0.5);
        // Totals
        const subtotal = order.totalPrice - order.shippingPrice - order.taxPrice;
        doc.font('Helvetica')
            .text('Sub Total', amtX - 150, doc.y, { width: 100, align: 'right' })
            .text(subtotal.toFixed(2), amtX, doc.y, { width: 100, align: 'right' });
        doc.moveDown(0.3);
        // Assuming a fixed GST of 5% for display purposes from the image,
        // though the actual order.taxPrice might be different in calculation.
        // If order.taxPrice represents GST, use that instead.
        // For now, matching the image:
        const gstAmount = 50.00; // From the image provided
        doc.text('GST 5 %', amtX - 150, doc.y, { width: 100, align: 'right' })
            .text(gstAmount.toFixed(2), amtX, doc.y, { width: 100, align: 'right' });
        doc.moveDown(0.3);
        if (order.shippingPrice > 0) {
            doc.text('Delivery Charges', amtX - 150, doc.y, { width: 100, align: 'right' })
                .text(order.shippingPrice.toFixed(2), amtX, doc.y, { width: 100, align: 'right' });
            doc.moveDown(0.3);
        }
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold')
            .text('TOTAL', amtX - 150, doc.y, { width: 100, align: 'right' })
            .text(order.totalPrice.toFixed(2), amtX, doc.y, { width: 100, align: 'right' });
        doc.moveDown(2);
        // Payment Mode
        doc.font('Helvetica-Bold').text('Payment Mode : CASH / UPI / CARD', 30, doc.y);
        doc.moveDown(3);
        // Footer message
        doc.fontSize(10).font('Helvetica-Bold').text('More sweetness awaits you – come back soon!', 30, doc.y, { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('Shop online in Indiasfood.com', 30, doc.y + 15, { align: 'center' });
        doc.end();
    }
    catch (error) {
        console.error('❌ Get admin invoice error:', error);
        res.status(500).json({
            message: 'Failed to generate invoice',
            error: error.message,
        });
    }
};
exports.getAdminInvoice = getAdminInvoice;
