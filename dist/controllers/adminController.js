"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRevenueToday = exports.getActiveDeliveryPersonsCount = exports.getTotalCustomersCount = exports.getTotalOrdersCount = exports.exportSales = exports.exportProducts = exports.exportCustomers = exports.exportOrders = exports.assignDeliveryPerson = exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategories = exports.getCustomerById = exports.getCustomers = exports.getDeliveryPersons = exports.uploadProductImages = exports.updateProduct = exports.createProduct = exports.updateOrderToDelivered = exports.updateOrderStatus = exports.getAllOrders = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const Product_1 = __importDefault(require("../models/Product"));
const User_1 = __importDefault(require("../models/User")); // Import User model
const Category_1 = __importDefault(require("../models/Category")); // Import Category model
const cloudinary_1 = __importDefault(require("../config/cloudinary")); // Import Cloudinary config
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
// @desc    Update order status
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
    const { error } = adminValidation_1.updateOrderStatusSchema.validate(req.body);
    if (error)
        return res.status(400).json({ message: error.details[0].message });
    const { status } = req.body;
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
            // Handle cancellation logic if needed
        } // Add more status transitions as needed
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
// @desc    Create a new product
// @route   POST /api/admin/products
// @access  Private/Admin
const createProduct = async (req, res) => {
    console.log('Attempting to create product. Request Body:', req.body);
    console.log('Authenticated User:', req.user);
    const { error } = adminValidation_1.createProductSchema.validate(req.body);
    if (error) {
        console.error('Product validation error:', error.details[0].message);
        return res.status(400).json({ message: error.details[0].message });
    }
    const { name, description, price, weight, shelfLife, category, countInStock, videoUrl, isActive } = req.body;
    try {
        // Check if category exists
        const existingCategory = await Category_1.default.findById(category);
        if (!existingCategory) {
            console.error('Category not found for ID:', category);
            return res.status(404).json({ message: 'Category not found' });
        }
        const product = new Product_1.default({
            name,
            description,
            price,
            weight,
            shelfLife,
            images: [], // Initialize as an empty array
            category,
            countInStock,
            videoUrl, // Include videoUrl
            isActive,
            user: req.user._id, // Assuming the admin creating the product is the user
        });
        const createdProduct = await product.save();
        console.log('Product created successfully:', createdProduct);
        res.status(201).json(createdProduct);
    }
    catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: error.message || 'Product creation failed' });
    }
};
exports.createProduct = createProduct;
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
    const { name, description, price, weight, shelfLife, category, countInStock, videoUrl, images, isActive } = req.body;
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
        product.name = name || product.name;
        product.description = description || product.description;
        product.price = price || product.price;
        product.weight = weight || product.weight;
        product.shelfLife = shelfLife || product.shelfLife;
        product.category = category || product.category;
        product.countInStock = countInStock !== undefined ? countInStock : product.countInStock;
        product.videoUrl = videoUrl !== undefined ? videoUrl : product.videoUrl;
        product.images = images !== undefined ? images : product.images; // Allow updating images array
        product.isActive = isActive !== undefined ? isActive : product.isActive; // Allow updating isActive
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
    console.log('Received request to upload images for product ID:', req.params.id);
    console.log('Files received:', req.files);
    try {
        const product = await Product_1.default.findById(req.params.id);
        if (product) {
            if (!req.files || req.files.length === 0) {
                console.error('No image files provided for product ID:', req.params.id);
                return res.status(400).json({ message: 'No image files provided.' });
            }
            const uploadedImages = [];
            for (const file of req.files) {
                console.log('Uploading file to Cloudinary:', file.originalname);
                // Use data URI for in-memory files
                const b64 = Buffer.from(file.buffer).toString("base64");
                let dataURI = "data:" + file.mimetype + ";base64," + b64;
                const result = await cloudinary_1.default.uploader.upload(dataURI, {
                    folder: 'indias-sweet-delivery/products',
                });
                uploadedImages.push(result.secure_url);
                console.log('Uploaded to Cloudinary, URL:', result.secure_url);
            }
            product.images = [...product.images, ...uploadedImages];
            await product.save();
            console.log('Product images updated and saved to DB for product ID:', req.params.id);
            res.status(200).json({ message: 'Images uploaded successfully', images: product.images });
        }
        else {
            console.error('Product not found for ID:', req.params.id);
            res.status(404).json({ message: 'Product not found' });
        }
    }
    catch (error) {
        console.error('Cloudinary upload error:', error);
        res.status(500).json({ message: error.message || 'Image upload failed' });
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
            const customerOrders = await Order_1.default.find({ user: customer._id }).populate('orderItems.product', 'name price');
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
    const { name, isActive } = req.body;
    try {
        const category = new Category_1.default({
            name,
            isActive,
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
    const { name, isActive } = req.body;
    try {
        const category = await Category_1.default.findById(req.params.id);
        if (category) {
            category.name = name || category.name;
            category.isActive = (isActive !== undefined) ? isActive : category.isActive;
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
        order.status = 'Assigned'; // Set status to Assigned
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
