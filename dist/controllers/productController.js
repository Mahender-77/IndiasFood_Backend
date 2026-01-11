"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicCategories = exports.getSweetsProducts = exports.getProductById = exports.getProducts = void 0;
const Product_1 = __importDefault(require("../models/Product"));
const Category_1 = __importDefault(require("../models/Category")); // Import Category model
// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
    const pageSize = 10;
    const page = Number(req.query.pageNumber) || 1;
    const keyword = req.query.keyword
        ? { name: { $regex: req.query.keyword, $options: 'i' } }
        : {};
    let categoryFilter = {};
    if (req.query.category && req.query.category !== 'all') {
        const category = await Category_1.default.findOne({ name: req.query.category });
        if (category) {
            categoryFilter = { category: category._id };
        }
        else {
            // If category not found, return empty products array
            return res.json({ products: [], page, pages: 0 });
        }
    }
    let sort = { createdAt: -1 }; // Default to newest
    switch (req.query.sortBy) {
        case 'price-low':
            sort = { price: 1 };
            break;
        case 'price-high':
            sort = { price: -1 };
            break;
        case 'name':
            sort = { name: 1 };
            break;
        case 'featured':
        default:
            sort = { createdAt: -1 }; // Or any other field for 'featured'
            break;
    }
    const count = await Product_1.default.countDocuments({ ...keyword, ...categoryFilter });
    const products = await Product_1.default.find({ ...keyword, ...categoryFilter })
        .populate('category', 'name') // Populate category name for frontend display
        .sort(sort)
        .limit(pageSize)
        .skip(pageSize * (page - 1));
    res.json({ products, page, pages: Math.ceil(count / pageSize) });
};
exports.getProducts = getProducts;
// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
    const product = await Product_1.default.findById(req.params.id).populate('category', 'name');
    if (product) {
        const similarProducts = await Product_1.default.find({
            category: product.category,
            _id: { $ne: product._id },
        }).limit(3).populate('category', 'name');
        res.json({ product, similarProducts });
    }
    else {
        res.status(404).json({ message: 'Product not found' });
    }
};
exports.getProductById = getProductById;
// @desc    Fetch products by category 'sweets'
// @route   GET /api/products/category/sweets
// @access  Public
const getSweetsProducts = async (req, res) => {
    const sweetsCategory = await Category_1.default.findOne({ name: 'Sweets' });
    if (sweetsCategory) {
        const products = await Product_1.default.find({ category: sweetsCategory._id }).populate('category', 'name');
        res.json(products);
    }
    else {
        res.json([]); // Return empty array if 'Sweets' category not found
    }
};
exports.getSweetsProducts = getSweetsProducts;
// @desc    Fetch all active categories
// @route   GET /api/products/categories
// @access  Public
const getPublicCategories = async (req, res) => {
    try {
        const categories = await Category_1.default.find({});
        const categoriesWithImages = await Promise.all(categories.map(async (category) => {
            const productWithImage = await Product_1.default.findOne({ category: category._id, images: { $exists: true, $ne: [] } }).select('images').lean();
            return { ...category.toObject(), imageUrl: productWithImage?.images[0] || '/images/placeholder.png' };
        }));
        res.json(categoriesWithImages);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getPublicCategories = getPublicCategories;
