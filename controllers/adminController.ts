import axios from 'axios';
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import Category from '../models/Category'; // Import Category model
import DeliverySettings from '../models/DeliverySettings';
import Order, { OrderDocument } from '../models/Order';
import Product from '../models/Product';
import User from '../models/User'; // Import User model
import PDFDocument from 'pdfkit'; // Import pdfkit

import { createCategorySchema, createProductSchema, updateCategorySchema, updateOrderDeliverySchema, updateOrderStatusSchema, updateProductSchema } from '../utils/adminValidation';

interface AuthenticatedRequest extends Request {
  user?: any; // Define a more specific User type if available
  files?: Express.Multer.File[]; // Add files property for Multer (after @types/multer install)
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





// @desc    Create a new product
// @route   POST /api/admin/inventory/create-product
// @access  Private/Admin
export const createProduct = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  // ---------------- VALIDATION ----------------

  const { error } = createProductSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: error.details[0].message
    });
  }

  const {
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
    isActive,
    isGITagged,
    isNewArrival,
    store
  } = req.body;

  try {
    // ---------------- CHECK CATEGORY ----------------

    const categoryExists = await Category.findById(category);
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

        if (
          !variant.type ||
          !variant.value ||
          variant.originalPrice < 0
        ) {
          return res.status(400).json({
            message: `Variant ${i + 1} is invalid`
          });
        }
      }
    }

    // ---------------- SAFETY: INVENTORY DEFAULT ----------------

    const safeInventory = Array.isArray(inventory)
      ? inventory
      : [];

    const safeVariants =
      Array.isArray(variants) && variants.length > 0
        ? variants
        : [];

    // If NO variants → force variantIndex = 0
    if (safeVariants.length === 0) {
      safeInventory.forEach((location: any) => {
        location.stock = location.stock?.map((s: any) => ({
          ...s,
          variantIndex: 0
        }));
      });
    }

    // ---------------- CREATE PRODUCT ----------------

    const product = new Product({
      name: name.trim(),
      description: description?.trim() || '',
      store,
      originalPrice:
        safeVariants.length === 0 ? originalPrice : undefined,
      offerPrice:
        safeVariants.length === 0 ? offerPrice : undefined,
      variants: safeVariants,
      shelfLife: shelfLife?.trim() || '',
      category,
      inventory: safeInventory,
      videoUrl: videoUrl?.trim() || '',
      images: images || [],
      isActive: isActive ?? true,
      isGITagged: isGITagged || false,
      isNewArrival: isNewArrival || false
    });

    const savedProduct = await product.save();

    // ---------------- RETURN POPULATED + LEAN VERSION ----------------
    // 🔥 This is the important part

    const populatedProduct = await Product.findById(
      savedProduct._id
    )
      .populate('category')
      .lean({ virtuals: true });

    return res.status(201).json({
      message: 'Product created successfully',
      product: populatedProduct
    });

  } catch (error: any) {
    console.error('Error creating product:', error);

    return res.status(500).json({
      message:
        error.message || 'Server error while creating product'
    });
  }
};



// @desc    Admin Update Order Status
// @route   PUT /api/admin/orders/:id/delivery-status
// @access  Admin

export const adminUpdateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { status, reason } = req.body;

    const order = await Order.findById(req.params.id);

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
      if (
        order.deliveryMode === 'delivery' &&
        order.uengage?.taskId
      ) {
        try {
          await axios.post(
            `${process.env.UENGAGE_BASE}/cancelTask`,
            {
              storeId: process.env.STORE_ID,
              taskId: order.uengage.taskId
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'access-token': process.env.UENGAGE_TOKEN
              }
            }
          );

          order.uengage.statusCode = 'CANCELLED';
          order.uengage.message = 'Cancelled by admin';

        } catch (err) {
          order.uengage.statusCode = 'CANCEL_FAILED';
          order.uengage.message = 'Failed to cancel delivery task';
        }
      }

      /* 📦 RESTORE STOCK */
      for (const item of order.orderItems) {
        const product = await Product.findById(item.product);
        if (!product) continue;

        const variantIndex =
          typeof item.selectedVariantIndex === 'number'
            ? item.selectedVariantIndex
            : 0;

        const locationName = order.nearestStore?.toLowerCase();
        if (!locationName) continue;

        const inventoryLocation = product.inventory?.find(
          inv => inv.location === locationName
        );

        if (!inventoryLocation) continue;

        const stockItem = inventoryLocation.stock.find(
          s => s.variantIndex === variantIndex
        );

        if (stockItem) {
          stockItem.quantity += item.qty;
        }

        await product.save();
      }

      // ✅ SAVE REASON FOR USER ONLY
      order.status = 'cancelled';
      order.cancelReason = reason;   // 🔥 shown to user
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

  } catch (error) {
    console.error('Admin update error:', error);
    return res.status(500).json({
      message: 'Failed to update order status'
    });
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


// @desc    Upload product images
// @route   POST /api/admin/products/:id/images
// @access  Private/Admin
// @desc    Update a product
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
export const updateProduct = async (req: AuthenticatedRequest, res: Response) => {
  const { error } = updateProductSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { name, description, originalPrice, offerPrice, variants, shelfLife, category, inventory, videoUrl, images, isActive, isGITagged, isNewArrival } = req.body;

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
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Product update failed' });
  }
};

// @desc    Upload product images
// @route   POST /api/admin/products/:id/images
// @access  Private/Admin
export const uploadProductImages = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No image files provided." });
    }

    const uploadedImages: string[] = [];

    for (const file of req.files as Express.Multer.File[]) {
      const ext = path.extname(file.originalname);
      const fileName = `products/${crypto.randomUUID()}${ext}`;

      const uploadUrl = `https://storage.bunnycdn.com/${process.env.BUNNY_STORAGE_ZONE}/${fileName}`;

      await axios.put(uploadUrl, file.buffer, {
        headers: {
          AccessKey: process.env.BUNNY_API_KEY!,
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
  } catch (error: any) {
    console.error("Bunny upload error:", error);
    res.status(500).json({
      message: error.message || "Image upload failed",
    });
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
          localField:'_id',
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
      // Convert string _id back to ObjectId for querying
      const mongoose = require('mongoose');
      const customerOrders = await Order.find({ user: new mongoose.Types.ObjectId(customer._id) }).populate('orderItems.product', 'name price');
      res.json({ ...customer, orderHistory: customerOrders });
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  }
   catch (error: any) {
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

  const { name, isActive, subcategories } = req.body;

  try {
    const category = new Category({
      name,
      isActive,
      subcategories,
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

  const { name, isActive, subcategories } = req.body;

  try {
    const category = await Category.findById(req.params.id);

    if (category) {
      category.name = name || category.name;
      category.isActive = (isActive !== undefined) ? isActive : category.isActive;
      category.subcategories = (subcategories !== undefined) ? subcategories : category.subcategories;

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
    order.status = 'confirmed'; // Set status to confirmed when assigning delivery

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

// @desc    Export orders by time period
// @route   GET /api/admin/export/orders/daily?date=2024-01-01
// @route   GET /api/admin/export/orders/weekly?week=2024-W01
// @route   GET /api/admin/export/orders/monthly?month=2024-01
// @access  Private/Admin
export const exportOrdersByTime = async (req: AuthenticatedRequest, res: Response) => {
  const { period } = req.params; // 'daily', 'weekly', 'monthly'
  const query = req.query;

  try {
    let dateFilter: any = {};
    let filename = '';

    if (period === 'daily' && query.date) {
      const startDate = new Date(query.date as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      dateFilter.createdAt = { $gte: startDate, $lt: endDate };
      filename = `orders_daily_${query.date}.json`;
    } else if (period === 'weekly' && query.week) {
      const [year, week] = (query.week as string).split('-W');
      const startDate = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 7);
      dateFilter.createdAt = { $gte: startDate, $lt: endDate };
      filename = `orders_weekly_${query.week}.json`;
    } else if (period === 'monthly' && query.month) {
      const [year, month] = (query.month as string).split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 1);
      dateFilter.createdAt = { $gte: startDate, $lt: endDate };
      filename = `orders_monthly_${query.month}.json`;
    } else {
      return res.status(400).json({ message: 'Invalid period or missing date parameter' });
    }

    const orders = await Order.find(dateFilter)
      .populate('user', 'id username email')
      .populate('deliveryPerson','id username email')
      .lean();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(JSON.stringify(orders, null, 2));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Export sales by time period
// @route   GET /api/admin/export/sales/daily?date=2024-01-01
// @route   GET /api/admin/export/sales/weekly?week=2024-W01
// @route   GET /api/admin/export/sales/monthly?month=2024-01
// @access  Private/Admin
export const exportSalesByTime = async (req: AuthenticatedRequest, res: Response) => {
  const { period } = req.params; // 'daily', 'weekly', 'monthly'
  const query = req.query;

  try {
    let dateFilter: any = { isPaid: true };
    let filename = '';

    if (period === 'daily' && query.date) {
      const startDate = new Date(query.date as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      dateFilter.createdAt = { $gte: startDate, $lt: endDate };
      filename = `sales_daily_${query.date}.json`;
    } else if (period === 'weekly' && query.week) {
      const [year, week] = (query.week as string).split('-W');
      const startDate = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 7);
      dateFilter.createdAt = { $gte: startDate, $lt: endDate };
      filename = `sales_weekly_${query.week}.json`;
    } else if (period === 'monthly' && query.month) {
      const [year, month] = (query.month as string).split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 1);
      dateFilter.createdAt = { $gte: startDate, $lt: endDate };
      filename = `sales_monthly_${query.month}.json`;
    } else {
      return res.status(400).json({ message: 'Invalid period or missing date parameter' });
    }

    // Get sales data for the specified period
    const salesData = await Order.aggregate([
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
    const totalRevenueResult = await Order.aggregate([
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
  }
   catch (error: any) {
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


// ==================== INVENTORY MANAGEMENT ====================

export const getAllProducts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const products = await Product.find()
      .populate('category')
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json(products);
  }
   catch (error) {
    console.error('Inventory fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch inventory' });
  }
}


// GET /api/admin/inventory/:location - Get inventory for specific location
export const getInventory = async (req: Request, res: Response) => {
  try {
    const { location } = req.params;
    const products = await Product.find({
      'inventory.location': location,
      isActive: true
    }).populate('category');

    res.json(products);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Validation middleware
const validateCreateProduct = (req: Request, res: Response, next: NextFunction) => {
  const { error } = createProductSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};

const validateUpdateProduct = (req: Request, res: Response, next: NextFunction) => {
  const { error } = updateProductSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};

// POST /api/admin/inventory/products - Create new product
export const createInventoryProduct = async (req: Request, res: Response) => {
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

    if (!mongoose.Types.ObjectId.isValid(productData.store)) {
      return res.status(400).json({ message: 'Invalid store ID' });
    }

    /* ---------- VERIFY STORE EXISTS (storeLocations.storeId) ---------- */

    const storeExists = await DeliverySettings.exists({
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

    if (
      (!productData.variants || productData.variants.length === 0) &&
      (productData.originalPrice === undefined || productData.originalPrice <= 0)
    ) {
      return res.status(400).json({
        message: 'Original price is required for non-variant products'
      });
    }

    /* ---------- CREATE PRODUCT ---------- */

    const product = new Product({
      ...productData,
      store: productData.store // 🔒 enforce store explicitly
    });

    await product.save();
    await product.populate('category');

    return res.status(201).json(product);
  } catch (error: any) {
    console.error('Error creating product:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation failed',
        errors: Object.values(error.errors).map((e: any) => e.message)
      });
    }

    return res.status(500).json({ message: error.message });
  }
};

// PUT /api/admin/inventory/:id - Update product + flags
// PUT /api/admin/inventory/products/:id
export const updateInventoryProduct = async (req: Request, res: Response) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: req.body }, // 🔥 SAFE UPDATE
      {
        new: true,
        runValidators: true // 🔥 IMPORTANT
      }
    ).populate('category');

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json(updatedProduct);
  } catch (error: any) {
    console.error("Update error:", error);
    res.status(400).json({ message: error.message });
  }
};


// PUT /api/admin/inventory/:id/stock - Update specific location stock
export const updateStock = async (req: Request, res: Response) => {
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
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Find if location already exists in inventory
    const locationIndex = product.inventory?.findIndex(inv => inv.location === location) ?? -1;

    if (locationIndex >= 0) {
      // Location exists - update or add variant stock
      const existingLocation = product.inventory![locationIndex];
      const stockIndex = existingLocation.stock?.findIndex(stock => stock.variantIndex === variantIndex) ?? -1;

      if (stockIndex >= 0) {
        // Variant stock exists - update quantity
        existingLocation.stock![stockIndex].quantity = quantity;
      } else {
        // Variant stock does not exist - initialize it
        existingLocation.stock!.push({
          variantIndex,
          quantity,
          lowStockThreshold: 5
        });
      }

      // Save the updated product
      await product.save();

    } else {
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

  } catch (error: any) {
    console.error('Error updating stock:', error);
    res.status(500).json({
      message: 'Failed to update stock',
      error: error.message
    });
  }
};

// PUT /api/admin/inventory/:id/flag - Toggle product flags
export const toggleFlag = async (req: Request, res: Response) => {
  try {
    const { flag, value } = req.body; // 'isGITagged' or 'isNewArrival'

    // Validate flag type
    if (!['isGITagged', 'isNewArrival'].includes(flag)) {
      return res.status(400).json({ message: 'Invalid flag type' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { [flag]: value },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/admin/inventory/products - Get all products for admin management
// DELETE /api/admin/inventory/:id - Deactivate product (soft delete)
export const deactivateProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// PUT /api/admin/inventory/:id/most-saled - Toggle product most saled flag
export const toggleMostSaled = async (req: Request, res: Response) => {
  try {
    const { value } = req.body; // boolean value for isMostSaled

    // Validate value type
    if (typeof value !== 'boolean') {
      return res.status(400).json({ message: 'Invalid value type for isMostSaled' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isMostSaled: value },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ success: true, isMostSaled: product.isMostSaled });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
// @desc    Get delivery settings
// @route   GET /api/admin/delivery-settings
// @access  Private/Admin
export const getDeliverySettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let settings = await DeliverySettings.findOne();

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
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch delivery settings" });
  }
};

// @desc    Get active delivery locations
// @route   GET /api/admin/delivery-locations
// @access  Private/Admin
// GET /admin/delivery-locations
export const getDeliveryLocations = async (req, res) => {
  const settings = await DeliverySettings.findOne({}, { storeLocations: 1 });

  res.json(
    settings.storeLocations
      .filter(s => s.isActive)
      .map(s => ({
        storeId: s.storeId,        // ✅ IMPORTANT
        name: s.name,
        displayName: s.name,
        city: s.city
      }))
  );
};


// @desc    Update delivery settings
// @route   PUT /api/admin/delivery-settings
// @access  Private/Admin
export const updateDeliverySettings = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { 
      pricePerKm, 
      baseCharge, 
      freeDeliveryThreshold, 
      gstPercentage,      // 🔥 NEW FIELD
      storeLocations 
    } = req.body;

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
    const hasActiveStore = storeLocations.some((s: any) => s.isActive);
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
    const processedStores = storeLocations.map((store: any) => ({
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
    let settings = await DeliverySettings.findOne();

    if (settings) {
      settings.pricePerKm = pricePerKm;
      settings.baseCharge = baseCharge;
      settings.freeDeliveryThreshold = freeDeliveryThreshold;
      settings.gstPercentage = gstPercentage;   // 🔥 SAVE GST
      settings.storeLocations = processedStores;

      await settings.save();
    } else {
      settings = await DeliverySettings.create({
        pricePerKm,
        baseCharge,
        freeDeliveryThreshold,
        gstPercentage,      // 🔥 ADD GST HERE
        storeLocations: processedStores
      });
    }

    res.json(settings);

  } catch (error: any) {

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
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


// @desc    Generate invoice for an order (Admin)
// @route   GET /api/admin/orders/:id/invoice
// @access  Private/Admin
export const getAdminInvoice = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'username email')
      .exec();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Admin does not need an ownership check for invoices

    const doc = new PDFDocument({ margin: 30 }); // Smaller margin for better fit

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${order._id}.pdf"`
    );

    doc.pipe(res);

    // Company Header
    doc.image(path.join(__dirname, '../assets/IndiasFood.png'), doc.page.width - 150, 30, { width: 120 });
    
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
    doc.fontSize(10).font('Helvetica').text('Order No :', 300, 170, {width: 100, align: 'right'});
    doc.font('Helvetica-Bold').text('INV-1001', 400, 170, {width: 150, align: 'right'}); // Assuming static INV-1001 for now

    const orderDate = (order as any).createdAt
      ? new Date((order as any).createdAt).toLocaleDateString('en-IN')
      : 'N/A';
    doc.font('Helvetica').text('Date :', 300, 185, {width: 100, align: 'right'});
    doc.font('Helvetica-Bold').text(orderDate, 400, 185, {width: 150, align: 'right'});

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

    doc.moveDown(0.5);
    doc.moveTo(itemX, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
    doc.moveDown(0.5);

    // Totals
    const subtotal =
      order.totalPrice - order.shippingPrice - order.taxPrice;
    
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
  } catch (error: any) {
    console.error('❌ Get admin invoice error:', error);
    res.status(500).json({
      message: 'Failed to generate invoice',
      error: error.message,
    });
  }
};

