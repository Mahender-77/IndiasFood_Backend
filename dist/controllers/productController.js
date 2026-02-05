"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNewArrivalProducts = exports.getGITaggedProducts = exports.getAllSubcategories = exports.getSubcategoriesByCategory = exports.getPublicCategories = exports.getSweetsProducts = exports.getProductById = exports.getProducts = void 0;
const Category_1 = __importDefault(require("../models/Category"));
const Product_1 = __importDefault(require("../models/Product"));
// @desc    Fetch all products with advanced filtering
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
    try {
        const pageSize = 12;
        const page = Number(req.query.pageNumber) || 1;
        // Search term handling
        const searchTerm = (req.query.search || req.query.keyword);
        const searchFilter = searchTerm
            ? {
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { description: { $regex: searchTerm, $options: 'i' } }
                ]
            }
            : {};
        // Category filter (main category)
        let categoryFilter = {};
        if (req.query.category && req.query.category !== 'all' && req.query.category !== '') {
            const category = await Category_1.default.findOne({
                name: { $regex: new RegExp(`^${req.query.category}$`, 'i') }
            });
            if (category) {
                categoryFilter = { category: category._id };
            }
            else {
                return res.json({ products: [], page, pages: 0 });
            }
        }
        // Subcategory filter (NEW)
        let subcategoryFilter = {};
        if (req.query.subcategories) {
            // Handle multiple subcategories (comma-separated)
            const subcategories = req.query.subcategories.split(',').map(s => s.trim());
            if (subcategories.length > 0) {
                subcategoryFilter = {
                    subcategory: { $in: subcategories }
                };
            }
        }
        // Sorting logic
        let sort = { createdAt: -1 };
        switch (req.query.sortBy) {
            case 'price-low':
                sort = { originalPrice: 1 };
                break;
            case 'price-high':
                sort = { originalPrice: -1 };
                break;
            case 'name':
                sort = { name: 1 };
                break;
            case 'featured':
            default:
                sort = { createdAt: -1 };
                break;
        }
        // Build final query
        const query = {
            ...searchFilter,
            ...categoryFilter,
            ...subcategoryFilter,
            isActive: true
        };
        const count = await Product_1.default.countDocuments(query);
        const products = await Product_1.default.find(query)
            .populate('category', 'name')
            .sort(sort)
            .limit(pageSize)
            .skip(pageSize * (page - 1));
        res.json({ products, page, pages: Math.ceil(count / pageSize) });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getProducts = getProducts;
// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
    try {
        const product = await Product_1.default.findById(req.params.id).populate('category', 'name');
        if (product) {
            const similarProducts = await Product_1.default.find({
                category: product.category,
                _id: { $ne: product._id },
                isActive: true
            }).limit(3).populate('category', 'name');
            res.json({ product, similarProducts });
        }
        else {
            res.status(404).json({ message: 'Product not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getProductById = getProductById;
// @desc    Fetch products by category 'sweets'
// @route   GET /api/products/category/sweets
// @access  Public
const getSweetsProducts = async (req, res) => {
    try {
        const sweetsCategory = await Category_1.default.findOne({ name: 'Sweets' });
        if (sweetsCategory) {
            const products = await Product_1.default.find({
                category: sweetsCategory._id,
                isActive: true
            }).populate('category', 'name');
            res.json(products);
        }
        else {
            res.json([]);
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getSweetsProducts = getSweetsProducts;
// @desc    Fetch all active categories with subcategories
// @route   GET /api/products/categories
// @access  Public
const getPublicCategories = async (req, res) => {
    try {
        const categories = await Category_1.default.find({ isActive: true });
        const categoriesWithImages = await Promise.all(categories.map(async (category) => {
            const productWithImage = await Product_1.default.findOne({
                category: category._id,
                images: { $exists: true, $ne: [] },
                isActive: true
            }).select('images').lean();
            return {
                ...category.toObject(),
                imageUrl: productWithImage?.images[0] || '/images/placeholder.png'
            };
        }));
        res.json(categoriesWithImages);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getPublicCategories = getPublicCategories;
// @desc    Fetch all subcategories for a category
// @route   GET /api/products/subcategories/:categoryName
// @access  Public
const getSubcategoriesByCategory = async (req, res) => {
    try {
        const categoryName = req.params.categoryName;
        const category = await Category_1.default.findOne({
            name: { $regex: new RegExp(`^${categoryName}$`, 'i') },
            isActive: true
        });
        if (category && category.subcategories) {
            const activeSubcategories = category.subcategories.filter(sub => sub.isActive);
            res.json(activeSubcategories);
        }
        else {
            res.json([]);
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getSubcategoriesByCategory = getSubcategoriesByCategory;
// @desc    Fetch all unique subcategories across all categories
// @route   GET /api/products/all-subcategories
// @access  Public
const getAllSubcategories = async (req, res) => {
    try {
        const categories = await Category_1.default.find({ isActive: true });
        const allSubcategories = [];
        categories.forEach(category => {
            if (category.subcategories) {
                category.subcategories.forEach(sub => {
                    if (sub.isActive) {
                        allSubcategories.push({
                            _id: sub._id,
                            name: sub.name,
                            isActive: sub.isActive,
                            categoryName: category.name,
                            categoryId: category._id
                        });
                    }
                });
            }
        });
        res.json(allSubcategories);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getAllSubcategories = getAllSubcategories;
// @desc    Fetch GI Tagged products
// @route   GET /api/products/gi-tagged
// @access  Public
const getGITaggedProducts = async (req, res) => {
    try {
        const pageSize = 12;
        const page = Number(req.query.pageNumber) || 1;
        const searchTerm = (req.query.search || req.query.keyword);
        const searchFilter = searchTerm
            ? {
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { description: { $regex: searchTerm, $options: 'i' } }
                ]
            }
            : {};
        // Subcategory filter
        let subcategoryFilter = {};
        if (req.query.subcategories) {
            const subcategories = req.query.subcategories.split(',').map(s => s.trim());
            if (subcategories.length > 0) {
                subcategoryFilter = { subcategory: { $in: subcategories } };
            }
        }
        let sort = { createdAt: -1 };
        switch (req.query.sortBy) {
            case 'price-low':
                sort = { originalPrice: 1 };
                break;
            case 'price-high':
                sort = { originalPrice: -1 };
                break;
            case 'name':
                sort = { name: 1 };
                break;
            default:
                sort = { createdAt: -1 };
        }
        const query = {
            ...searchFilter,
            ...subcategoryFilter,
            isGITagged: true,
            isActive: true
        };
        const count = await Product_1.default.countDocuments(query);
        const products = await Product_1.default.find(query)
            .populate('category', 'name')
            .sort(sort)
            .limit(pageSize)
            .skip(pageSize * (page - 1));
        res.json({ products, page, pages: Math.ceil(count / pageSize) });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getGITaggedProducts = getGITaggedProducts;
// @desc    Fetch New Arrival products
// @route   GET /api/products/new-arrivals
// @access  Public
const getNewArrivalProducts = async (req, res) => {
    try {
        const pageSize = 12;
        const page = Number(req.query.pageNumber) || 1;
        const searchTerm = (req.query.search || req.query.keyword);
        const searchFilter = searchTerm
            ? {
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { description: { $regex: searchTerm, $options: 'i' } }
                ]
            }
            : {};
        // Subcategory filter
        let subcategoryFilter = {};
        if (req.query.subcategories) {
            const subcategories = req.query.subcategories.split(',').map(s => s.trim());
            if (subcategories.length > 0) {
                subcategoryFilter = { subcategory: { $in: subcategories } };
            }
        }
        let sort = { createdAt: -1 };
        switch (req.query.sortBy) {
            case 'price-low':
                sort = { originalPrice: 1 };
                break;
            case 'price-high':
                sort = { originalPrice: -1 };
                break;
            case 'name':
                sort = { name: 1 };
                break;
            default:
                sort = { createdAt: -1 };
        }
        const query = {
            ...searchFilter,
            ...subcategoryFilter,
            isNewArrival: true,
            isActive: true
        };
        const count = await Product_1.default.countDocuments(query);
        const products = await Product_1.default.find(query)
            .populate('category', 'name')
            .sort(sort)
            .limit(pageSize)
            .skip(pageSize * (page - 1));
        res.json({ products, page, pages: Math.ceil(count / pageSize) });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getNewArrivalProducts = getNewArrivalProducts;
