import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order';
import Product from '../models/Product';
import User from '../models/User'; // Import User model
import Category from '../models/Category'; // Import Category model
import cloudinary from '../config/cloudinary'; // Import Cloudinary config
import upload from '../middleware/multer'; // Import Multer middleware
import { createProductSchema, updateProductSchema, updateOrderStatusSchema, updateOrderDeliverySchema, createCategorySchema, updateCategorySchema } from '../utils/adminValidation';

interface AuthenticatedRequest extends Request {
  user?: any; // Define a more specific User type if available
  files?: Express.Multer.File[]; // Add files property for Multer (after @types/multer install)
}

interface OrderDocument extends mongoose.Document {
  user: mongoose.Schema.Types.ObjectId;
  orderItems: Array<{ name: string; qty: number; image: string; price: number; product: mongoose.Schema.Types.ObjectId; }>;
  shippingAddress: { address: string; city: string; postalCode: string; country: string; };
  paymentMethod: string;
  paymentResult?: { id: string; status: string; update_time: string; email_address: string; };
  taxPrice: number;
  shippingPrice: number;
  totalPrice: number;
  isPaid: boolean;
  paidAt?: Date;
  isDelivered: boolean;
  deliveredAt?: Date;
  deliveryPerson?: mongoose.Schema.Types.ObjectId;
  eta?: string;
  status: string;
}

// @desc    Get all orders
// @route   GET /api/admin/orders
// @access  Private/Admin
export const getAllOrders = async (req: AuthenticatedRequest, res: Response) => {
  const keyword = req.query.keyword
    ? {
        'user.username': { $regex: req.query.keyword as string, $options: 'i' },
      }
    : {};
  const orders = await Order.find({ ...keyword }).populate('user', 'id username email').populate('deliveryPerson', 'id username email');
  res.json(orders);
};

// @desc    Update order status
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { error } = updateOrderStatusSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { status } = req.body;
  const order: OrderDocument | null = await Order.findById(req.params.id);

  if (order) {
    if (status === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = new Date();
    } else if (status === 'confirmed') {
      order.isPaid = true;
      order.paidAt = new Date();
    } else if (status === 'cancelled') {
      // Handle cancellation logic if needed
    } // Add more status transitions as needed
    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } else {
    res.status(404).json({ message: 'Order not found' });
  }
};

// @desc    Update order delivery status
// @route   PUT /api/admin/orders/:id/delivery
// @access  Private/Admin
export const updateOrderToDelivered = async (req: AuthenticatedRequest, res: Response) => {
  const { error } = updateOrderDeliverySchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { isDelivered } = req.body;
  const order: OrderDocument | null = await Order.findById(req.params.id);

  if (order) {
    order.isDelivered = isDelivered;
    if (isDelivered) {
      order.deliveredAt = new Date();
    } else {
      order.deliveredAt = undefined;
    }

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } else {
    res.status(404).json({ message: 'Order not found' });
  }
};

// @desc    Create a new product
// @route   POST /api/admin/products
// @access  Private/Admin
export const createProduct = async (req: AuthenticatedRequest, res: Response) => {
  console.log('Attempting to create product. Request Body:', req.body);
  console.log('Authenticated User:', req.user);

  const { error } = createProductSchema.validate(req.body);
  if (error) {
    console.error('Product validation error:', error.details[0].message);
    return res.status(400).json({ message: error.details[0].message });
  }

  const { name, description, price, weight, shelfLife, category, countInStock, videoUrl, isActive } = req.body;

  try {
    // Check if category exists
    const existingCategory = await Category.findById(category);
    if (!existingCategory) {
      console.error('Category not found for ID:', category);
      return res.status(404).json({ message: 'Category not found' });
    }

    const product = new Product({
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
  } catch (error: any) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: error.message || 'Product creation failed' });
  }
};

// @desc    Upload product images
// @route   POST /api/admin/products/:id/images
// @access  Private/Admin
// @desc    Update a product
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
export const updateProduct = async (req: AuthenticatedRequest, res: Response) => {
  const { error } = updateProductSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { name, description, price, weight, shelfLife, category, countInStock, videoUrl, images, isActive } = req.body;

  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if category exists if provided
    if (category) {
      const existingCategory = await Category.findById(category);
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
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Product update failed' });
  }
};

// @desc    Upload product images
// @route   POST /api/admin/products/:id/images
// @access  Private/Admin
export const uploadProductImages = async (req: AuthenticatedRequest, res: Response) => {
  console.log('Received request to upload images for product ID:', req.params.id);
  console.log('Files received:', req.files);

  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      if (!req.files || req.files.length === 0) {
        console.error('No image files provided for product ID:', req.params.id);
        return res.status(400).json({ message: 'No image files provided.' });
      }

      const uploadedImages = [];
      for (const file of req.files as Express.Multer.File[]) {
        console.log('Uploading file to Cloudinary:', file.originalname);
        // Use data URI for in-memory files
        const b64 = Buffer.from(file.buffer).toString("base64");
        let dataURI = "data:" + file.mimetype + ";base64," + b64;

        const result = await cloudinary.uploader.upload(dataURI, {
          folder: 'indias-sweet-delivery/products',
        });
        uploadedImages.push(result.secure_url);
        console.log('Uploaded to Cloudinary, URL:', result.secure_url);
      }

      product.images = [...product.images, ...uploadedImages];
      await product.save();
      console.log('Product images updated and saved to DB for product ID:', req.params.id);
      res.status(200).json({ message: 'Images uploaded successfully', images: product.images });
    } else {
      console.error('Product not found for ID:', req.params.id);
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ message: error.message || 'Image upload failed' });
  }
};

// @desc    Get all users with role \'delivery\'
// @route   GET /api/admin/delivery-persons
// @access  Private/Admin
export const getDeliveryPersons = async (req: AuthenticatedRequest, res: Response) => {
  const deliveryPersons = await User.find({ role: 'delivery' }).select('-password');
    res.json(deliveryPersons);
};

// @desc    Get all customers (users with role \'user\')
// @route   GET /api/admin/customers
// @access  Private/Admin
export const getCustomers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customers = await User.aggregate([
      { $match: { role: 'user' } },
      { $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'user',
          as: 'orders',
      }},
      { $addFields: {
          totalOrders: { $size: '$orders' },
          // You can add more aggregated fields here if needed
      }},
      { $project: {
          password: 0, // Exclude password
          orders: 0,   // Exclude the raw orders array from the top level
      }},
    ]);
    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get customer by ID with order history
// @route   GET /api/admin/customers/:id
// @access  Private/Admin
export const getCustomerById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customer = await User.findById(req.params.id)
      .select('-password') // Exclude password
      .lean(); // Return plain JavaScript objects

    if (customer) {
      const customerOrders = await Order.find({ user: customer._id }).populate('orderItems.product', 'name price');
      res.json({ ...customer, orderHistory: customerOrders });
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all categories
// @route   GET /api/admin/categories
// @access  Private/Admin
export const getCategories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = await Category.find({});
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new category
// @route   POST /api/admin/categories
// @access  Private/Admin
export const createCategory = async (req: AuthenticatedRequest, res: Response) => {
  const { error } = createCategorySchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { name, isActive } = req.body;

  try {
    const category = new Category({
      name,
      isActive,
    });

    const createdCategory = await category.save();
    res.status(201).json(createdCategory);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a category
// @route   PUT /api/admin/categories/:id
// @access  Private/Admin
export const updateCategory = async (req: AuthenticatedRequest, res: Response) => {
  const { error } = updateCategorySchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { name, isActive } = req.body;

  try {
    const category = await Category.findById(req.params.id);

    if (category) {
      category.name = name || category.name;
      category.isActive = (isActive !== undefined) ? isActive : category.isActive;

      const updatedCategory = await category.save();
      res.json(updatedCategory);
    } else {
      res.status(404).json({ message: 'Category not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a category
// @route   DELETE /api/admin/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);

    if (category) {
      await category.deleteOne();
      res.json({ message: 'Category removed' });
    } else {
      res.status(404).json({ message: 'Category not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign a delivery person to an order
// @route   PUT /api/admin/orders/:id/assign-delivery
// @access  Private/Admin
export const assignDeliveryPerson = async (req: AuthenticatedRequest, res: Response) => {
  const { deliveryPersonId, eta } = req.body;

  // Validate input (deliveryPersonId is a valid ObjectId, eta is a string)\

  const order: OrderDocument | null = await Order.findById(req.params.id);

  if (order) {
    const deliveryPerson = await User.findById(deliveryPersonId);
    if (!deliveryPerson || deliveryPerson.role !== 'delivery') {
      return res.status(400).json({ message: 'Invalid delivery person ID or not a delivery role' });
    }
    order.deliveryPerson = deliveryPersonId;
    order.eta = eta;
    order.status = 'Assigned'; // Set status to Assigned

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } else {
    res.status(404).json({ message: 'Order not found' });
  }
};

// @desc    Export all orders as JSON
// @route   GET /api/admin/export/orders
// @access  Private/Admin
export const exportOrders = async (req: AuthenticatedRequest, res: Response) => {
  const orders = await Order.find({}).populate('user', 'id username email').populate('deliveryPerson','id username email').lean();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=orders.json');
  res.send(JSON.stringify(orders, null, 2));
};

// @desc    Export all customers as JSON
// @route   GET /api/admin/export/customers
// @access  Private/Admin
export const exportCustomers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customers = await User.aggregate([
      { $match: { role: 'user' } },
      { $lookup: {
          from: 'orders',
          localField:'_id',
          foreignField: 'user',
          as: 'orders',
      }},
      { $project: {
          _id: 1,
          username: 1,
          email: 1,
          addresses: 1,
          totalOrders: { $size: '$orders' },
          createdAt: 1,
          updatedAt: 1,
      }},
    ]);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=customers.json');
    res.send(JSON.stringify(customers, null, 2));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Export all products as JSON
// @route   GET /api/admin/export/products
// @access  Private/Admin
export const exportProducts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const products = await Product.find({}).populate('category', 'name').lean();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=products.json');
    res.send(JSON.stringify(products, null, 2));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Export sales data (monthly sales and total revenue)
// @route   GET /api/admin/export/sales
// @access  Private/Admin
export const exportSales = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const salesByMonth = await Order.aggregate([
      { $match: { isPaid: true } }, // Only consider paid orders
      { $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          totalSales: { $sum: '$totalPrice' },
          count: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const totalRevenueResult = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: {
          _id: null,
          totalRevenue: { $sum: '$totalPrice' },
      }},
    ]);

    const totalRevenue = totalRevenueResult.length > 0 ? totalRevenueResult[0].totalRevenue : 0;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=sales.json');
    res.send(JSON.stringify({ monthlySales: salesByMonth, totalRevenue }, null, 2));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get total number of orders
// @route   GET /api/admin/stats/orders-count
// @access  Private/Admin
export const getTotalOrdersCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await Order.countDocuments({});
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get total number of customers
// @route   GET /api/admin/stats/customers-count
// @access  Private/Admin
export const getTotalCustomersCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await User.countDocuments({ role: 'user' });
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get total number of active delivery persons
// @route   GET /api/admin/stats/delivery-persons-count
// @access  Private/Admin
export const getActiveDeliveryPersonsCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await User.countDocuments({ role: 'delivery' });
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get total revenue for today
// @route   GET /api/admin/stats/revenue-today
// @access  Private/Admin
export const getRevenueToday = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const revenueResult = await Order.aggregate([
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
