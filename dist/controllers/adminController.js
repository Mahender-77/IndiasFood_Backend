"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDeliverySettings = exports.getDeliveryLocations = exports.getDeliverySettings = exports.deactivateProduct = exports.toggleFlag = exports.updateStock = exports.updateInventoryProduct = exports.createInventoryProduct = exports.getInventory = exports.getAllProducts = exports.getRevenueToday = exports.getActiveDeliveryPersonsCount = exports.getTotalCustomersCount = exports.getTotalOrdersCount = exports.exportSalesByTime = exports.exportOrdersByTime = exports.exportSales = exports.exportProducts = exports.exportCustomers = exports.exportOrders = exports.assignDeliveryPerson = exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategories = exports.getCustomerById = exports.getCustomers = exports.getDeliveryPersons = exports.uploadProductImages = exports.updateProduct = exports.updateOrderToDelivered = exports.updateOrderStatus = exports.createProduct = exports.getAllOrders = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const path_1 = __importDefault(require("path"));
const Category_1 = __importDefault(require("../models/Category")); // Import Category model
const DeliverySettings_1 = __importDefault(require("../models/DeliverySettings"));
const Order_1 = __importDefault(require("../models/Order"));
const Product_1 = __importDefault(require("../models/Product"));
const User_1 = __importDefault(require("../models/User")); // Import User model
const adminValidation_1 = require("../utils/adminValidation");
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
// @route   POST /api/admin/products
// @access  Private/Admin
const createProduct = async (req, res) => {
    // Validate input data
    const { error } = adminValidation_1.createProductSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    const { name, description, originalPrice, offerPrice, variants, shelfLife, category, inventory, videoUrl, images, isActive, isGITagged, isNewArrival } = req.body;
    try {
        // Check if category exists
        const categoryExists = await Category_1.default.findById(category);
        if (!categoryExists) {
            return res.status(400).json({ message: 'Invalid category ID' });
        }
        // Validate variants if provided
        if (variants && variants.length > 0) {
            for (let i = 0; i < variants.length; i++) {
                const variant = variants[i];
                if (!variant.type || !variant.value || variant.originalPrice < 0) {
                    return res.status(400).json({ message: `Variant ${i + 1} is missing required fields or has invalid pricing` });
                }
            }
        }
        // Create the product
        const product = new Product_1.default({
            name,
            description,
            originalPrice,
            offerPrice,
            variants,
            shelfLife,
            category,
            inventory,
            videoUrl,
            images,
            isActive: isActive !== undefined ? isActive : true,
            isGITagged: isGITagged || false,
            isNewArrival: isNewArrival || false
        });
        const createdProduct = await product.save();
        res.status(201).json({
            message: 'Product created successfully',
            product: createdProduct
        });
    }
    catch (error) {
        console.error('Error creating product:', error);
        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((err) => err.message);
            return res.status(400).json({ message: 'Validation Error', details: messages });
        }
        // Handle duplicate key errors
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Product with this name already exists' });
        }
        res.status(500).json({ message: 'Server error while creating product' });
    }
};
exports.createProduct = createProduct;
// @desc    Update order status
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
    const { error } = adminValidation_1.updateOrderStatusSchema.validate(req.body);
    if (error)
        return res.status(400).json({ message: error.details[0].message });
    const { status, cancelReason } = req.body;
    const order = await Order_1.default.findById(req.params.id);
    if (order) {
        if (status === 'delivered') {
            order.isDelivered = true;
            order.deliveredAt = new Date();
        }
        else if (status === 'confirmed') {
            order.isPaid = true;
            order.paidAt = new Date();
        }
        else if (status === 'cancelled') {
            order.status = 'cancelled';
            order.cancelReason = cancelReason;
            order.cancelledAt = new Date();
            // Clear delivery assignments when cancelled
            order.deliveryPerson = undefined;
            order.eta = undefined;
        }
        else {
            order.status = status;
        }
        const updatedOrder = await order.save();
        res.json(updatedOrder);
    }
    else {
        res.status(404).json({ message: 'Order not found' });
    }
};
exports.updateOrderStatus = updateOrderStatus;
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
    const { name, description, originalPrice, offerPrice, variants, shelfLife, category, inventory, videoUrl, images, isActive, isGITagged, isNewArrival } = req.body;
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
        product.shelfLife = shelfLife !== undefined ? shelfLife : product.shelfLife;
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
        const products = await Product_1.default.find({}).populate('category', 'name _id');
        res.json(products);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
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
// POST /api/admin/inventory/products - Create new product
const createInventoryProduct = async (req, res) => {
    try {
        const productData = req.body;
        /* ---------- BASIC VALIDATION ---------- */
        if (!productData.name?.trim()) {
            return res.status(400).json({ message: 'Product name is required' });
        }
        if (!productData.category) {
            return res.status(400).json({ message: 'Category is required' });
        }
        if (!productData.store) {
            return res.status(400).json({ message: 'Store ID is required' });
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(productData.store)) {
            return res.status(400).json({ message: 'Invalid store ID' });
        }
        /* ---------- VERIFY STORE EXISTS (storeLocations.storeId) ---------- */
        const storeExists = await DeliverySettings_1.default.exists({
            storeLocations: {
                $elemMatch: {
                    storeId: productData.store,
                    isActive: true // optional but recommended
                }
            }
        });
        if (!storeExists) {
            return res.status(400).json({ message: 'Store not found or inactive' });
        }
        /* ---------- PRICE VALIDATION ---------- */
        if ((!productData.variants || productData.variants.length === 0) &&
            (productData.originalPrice === undefined || productData.originalPrice <= 0)) {
            return res.status(400).json({
                message: 'Original price is required for non-variant products'
            });
        }
        /* ---------- CREATE PRODUCT ---------- */
        const product = new Product_1.default({
            ...productData,
            store: productData.store // 🔒 enforce store explicitly
        });
        await product.save();
        await product.populate('category');
        return res.status(201).json(product);
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
// PUT /api/admin/inventory/:id - Update product + flags
const updateInventoryProduct = async (req, res) => {
    try {
        const product = await Product_1.default.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('category');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.updateInventoryProduct = updateInventoryProduct;
// PUT /api/admin/inventory/:id/stock - Update specific location stock
const updateStock = async (req, res) => {
    try {
        // Validate input parameters
        const { id } = req.params;
        const { location, variantIndex, quantity } = req.body;
        if (!id || !location || typeof variantIndex !== 'number' || typeof quantity !== 'number') {
            return res.status(400).json({
                message: 'Invalid input parameters',
                required: 'productId, location, variantIndex (number), quantity (number)'
            });
        }
        if (quantity < 0) {
            return res.status(400).json({ message: 'Quantity cannot be negative' });
        }
        // Check if product exists
        const product = await Product_1.default.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        // Find if location already exists in inventory
        const locationIndex = product.inventory?.findIndex(inv => inv.location === location) ?? -1;
        if (locationIndex >= 0) {
            // Location exists - update or add variant stock
            const existingLocation = product.inventory[locationIndex];
            const stockIndex = existingLocation.stock?.findIndex(stock => stock.variantIndex === variantIndex) ?? -1;
            if (stockIndex >= 0) {
                // Variant stock exists - update quantity
                existingLocation.stock[stockIndex].quantity = quantity;
            }
            else {
                // Variant stock does not exist - initialize it
                existingLocation.stock.push({
                    variantIndex,
                    quantity,
                    lowStockThreshold: 5
                });
            }
            // Save the updated product
            await product.save();
        }
        else {
            // Location does NOT exist - create new inventory entry
            if (!product.inventory) {
                product.inventory = [];
            }
            product.inventory.push({
                location,
                stock: [{
                        variantIndex,
                        quantity,
                        lowStockThreshold: 5
                    }]
            });
            // Save the updated product
            await product.save();
        }
        res.json({
            success: true,
            message: `Stock updated successfully for ${location} (variant ${variantIndex})`,
            data: {
                location,
                variantIndex,
                quantity
            }
        });
    }
    catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({
            message: 'Failed to update stock',
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
// @desc    Update delivery settings
// @route   PUT /api/admin/delivery-settings
// @access  Private/Admin
const updateDeliverySettings = async (req, res) => {
    try {
        const { pricePerKm, baseCharge, freeDeliveryThreshold, storeLocations } = req.body;
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
        // 3️⃣ Validate each store (NO storeId validation - it's auto-generated!)
        for (let i = 0; i < storeLocations.length; i++) {
            const store = storeLocations[i];
            const storeNum = i + 1;
            if (!store.name || !store.name.trim()) {
                return res.status(400).json({
                    message: `Store ${storeNum}: Store name is required`
                });
            }
            if (!store.contact_number || !store.contact_number.trim()) {
                return res.status(400).json({
                    message: `Store ${storeNum}: Contact number is required`
                });
            }
            if (!store.address || !store.address.trim()) {
                return res.status(400).json({
                    message: `Store ${storeNum}: Address is required`
                });
            }
            if (!store.city || !store.city.trim()) {
                return res.status(400).json({
                    message: `Store ${storeNum}: City is required`
                });
            }
            if (typeof store.latitude !== 'number') {
                return res.status(400).json({
                    message: `Store ${storeNum}: Valid latitude is required (received: ${typeof store.latitude})`
                });
            }
            if (typeof store.longitude !== 'number') {
                return res.status(400).json({
                    message: `Store ${storeNum}: Valid longitude is required (received: ${typeof store.longitude})`
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
        // 4️⃣ Process store locations - ensure storeId is generated for new stores
        const processedStores = storeLocations.map((store) => {
            // If store already has a storeId (from DB), keep it
            // Otherwise, a new one will be auto-generated by Mongoose
            return {
                ...(store.storeId && { storeId: store.storeId }), // Keep existing storeId if present
                name: store.name.trim(),
                contact_number: store.contact_number.trim(),
                address: store.address.trim(),
                city: store.city.trim(),
                latitude: store.latitude,
                longitude: store.longitude,
                isActive: store.isActive
            };
        });
        // 5️⃣ Create or Update settings
        let settings = await DeliverySettings_1.default.findOne();
        if (settings) {
            settings.pricePerKm = pricePerKm;
            settings.baseCharge = baseCharge;
            settings.freeDeliveryThreshold = freeDeliveryThreshold;
            settings.storeLocations = processedStores;
            await settings.save();
        }
        else {
            settings = await DeliverySettings_1.default.create({
                pricePerKm,
                baseCharge,
                freeDeliveryThreshold,
                storeLocations: processedStores
            });
        }
        res.json(settings);
    }
    catch (error) {
        // Handle Mongoose validation errors
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
