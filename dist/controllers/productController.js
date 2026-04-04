"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDealOfTheDayProducts = exports.getMostSoldProducts = exports.getNewArrivalProducts = exports.getGITaggedProducts = exports.getAllSubcategories = exports.getSubcategoriesByCategory = exports.getPublicCategories = exports.getSweetsProducts = exports.getProductById = exports.getProducts = void 0;
const Category_1 = __importDefault(require("../models/Category"));
const Product_1 = __importDefault(require("../models/Product"));
const productNewArrival_1 = require("../utils/productNewArrival");
// @desc    Fetch all products with advanced filtering
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
    try {
        const isVariantInDeal = (product, variantIndex) => {
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            const inventory = product.inventory || [];
            for (const loc of inventory) {
                for (const batch of loc.batches || []) {
                    if (batch.variantIndex !== variantIndex)
                        continue;
                    const triggerDays = batch.dealTriggerDays ?? product.dealTriggerDays ?? 0;
                    const discount = batch.dealDiscountPercent ?? product.dealDiscountPercent ?? 0;
                    if (triggerDays <= 0 || discount <= 0)
                        continue;
                    const expiry = new Date(batch.expiryDate);
                    expiry.setHours(0, 0, 0, 0);
                    const dealStart = new Date(expiry);
                    dealStart.setDate(dealStart.getDate() - triggerDays);
                    if (currentDate >= dealStart &&
                        currentDate <= expiry &&
                        (batch.quantity || 0) > 0) {
                        return true;
                    }
                }
            }
            return false;
        };
        const filterDealVariantsFromListing = (rawProducts) => rawProducts
            .map((product) => {
            if (!product.variants || product.variants.length === 0)
                return product;
            const filteredVariants = product.variants.filter((_, index) => {
                return !isVariantInDeal(product, index);
            });
            return {
                ...product,
                variants: filteredVariants
            };
        })
            .filter((product) => {
            return !product.variants || product.variants.length > 0;
        });
        const pageSize = 12;
        const page = Number(req.query.pageNumber) || 1;
        /* ---------------- SEARCH FILTER ---------------- */
        const searchTerm = (req.query.search || req.query.keyword);
        const searchFilter = searchTerm
            ? {
                $or: [
                    { name: { $regex: searchTerm, $options: "i" } },
                    { description: { $regex: searchTerm, $options: "i" } },
                ],
            }
            : {};
        /* ---------------- CATEGORY FILTER ---------------- */
        let categoryFilter = {};
        if (req.query.category &&
            req.query.category !== "all" &&
            req.query.category !== "") {
            const category = await Category_1.default.findOne({
                name: { $regex: new RegExp(`^${req.query.category}$`, "i") },
            });
            if (category) {
                categoryFilter = { category: category._id };
            }
            else {
                return res.json({ products: [], page, pages: 0 });
            }
        }
        /* ---------------- SUBCATEGORY FILTER ---------------- */
        let subcategoryFilter = {};
        if (req.query.subcategories) {
            const subcategories = req.query.subcategories
                .split(",")
                .map((s) => s.trim());
            if (subcategories.length > 0) {
                subcategoryFilter = {
                    subcategory: { $in: subcategories },
                };
            }
        }
        /* ---------------- FINAL QUERY ---------------- */
        const query = {
            ...searchFilter,
            ...categoryFilter,
            ...subcategoryFilter,
            isActive: true,
        };
        const sortBy = req.query.sortBy;
        /* =====================================================
           🔥 PRICE SORTING (VARIANT + NON VARIANT SAFE)
        ====================================================== */
        if (sortBy === "price-low" || sortBy === "price-high") {
            const sortDirection = sortBy === "price-low" ? 1 : -1;
            const rawProducts = await Product_1.default.aggregate([
                { $match: query },
                {
                    $addFields: {
                        effectivePrice: {
                            $cond: {
                                // If product has variants
                                if: { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
                                then: {
                                    $min: {
                                        $map: {
                                            input: "$variants",
                                            as: "v",
                                            in: {
                                                $ifNull: ["$$v.offerPrice", "$$v.originalPrice"],
                                            },
                                        },
                                    },
                                },
                                // If product has NO variants
                                else: {
                                    $ifNull: ["$offerPrice", "$originalPrice"],
                                },
                            },
                        },
                    },
                },
                { $sort: { effectivePrice: sortDirection } },
                { $skip: pageSize * (page - 1) },
                { $limit: pageSize },
            ]);
            const count = await Product_1.default.countDocuments(query);
            const products = filterDealVariantsFromListing(rawProducts);
            return res.json({
                products,
                page,
                pages: Math.ceil(count / pageSize),
            });
        }
        /* =====================================================
           🔥 NORMAL SORTING (NO PRICE)
        ====================================================== */
        let sort = { createdAt: -1 };
        switch (sortBy) {
            case "name":
                sort = { name: 1 };
                break;
            case "featured":
            default:
                sort = { createdAt: -1 };
                break;
        }
        const count = await Product_1.default.countDocuments(query);
        const rawProducts = await Product_1.default.find(query)
            .populate("category", "name")
            .sort(sort)
            .limit(pageSize)
            .skip(pageSize * (page - 1))
            .lean();
        const products = filterDealVariantsFromListing(rawProducts);
        res.json({
            products,
            page,
            pages: Math.ceil(count / pageSize),
        });
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
        await (0, productNewArrival_1.expireStaleNewArrivalFlags)();
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
// @desc    Fetch Most Sold products
// @route   GET /api/products/most-saled
// @access  Public
const getMostSoldProducts = async (req, res) => {
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
            isMostSaled: true,
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
exports.getMostSoldProducts = getMostSoldProducts;
// @desc    Fetch Deal of the Day products (per-batch deal logic, FIFO-friendly)
// Each batch has its own dealTriggerDays & dealDiscountPercent (see Product.batches).
// When a batch is within its trigger days of expiry and not yet expired, that variant
// qualifies; we keep the best (max) discount per variant. Full `variants` are preserved;
// `dealVariants` lists only variants in the deal window (with dealPrice / dealDiscountPercent).
// Fallback: product-level dealTriggerDays/dealDiscountPercent when batch has none.
// @route   GET /api/products/deal-of-the-day
// @access  Public
const getDealOfTheDayProducts = async (req, res) => {
    try {
        const pageSize = Number(req.query.pageSize) || 10;
        const page = Number(req.query.pageNumber) || 1;
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        const allProducts = await Product_1.default.find({ isActive: true })
            .populate('category', 'name')
            .lean();
        const expiringProducts = [];
        for (const product of allProducts) {
            const productTriggerDays = product.dealTriggerDays ?? 0;
            const productDiscountPercent = product.dealDiscountPercent ?? 0;
            const dealVariantsMap = new Map();
            const inventory = product.inventory || [];
            for (const loc of inventory) {
                for (const batch of loc.batches || []) {
                    const triggerDays = batch.dealTriggerDays ?? productTriggerDays;
                    const batchDiscount = batch.dealDiscountPercent ?? productDiscountPercent;
                    if (triggerDays <= 0 || batchDiscount <= 0)
                        continue;
                    const batchExpiry = new Date(batch.expiryDate);
                    batchExpiry.setHours(0, 0, 0, 0);
                    const dealStartDate = new Date(batchExpiry);
                    dealStartDate.setDate(dealStartDate.getDate() - triggerDays);
                    if (currentDate >= dealStartDate &&
                        currentDate <= batchExpiry &&
                        (batch.quantity || 0) > 0) {
                        const variantIndex = batch.variantIndex ?? 0;
                        const existing = dealVariantsMap.get(variantIndex);
                        if (!existing || batchDiscount > existing.discount) {
                            dealVariantsMap.set(variantIndex, {
                                discount: batchDiscount,
                                expiry: batchExpiry
                            });
                        }
                    }
                }
            }
            if (dealVariantsMap.size > 0) {
                const filteredVariants = [];
                for (const [variantIndex, data] of dealVariantsMap.entries()) {
                    const variant = product.variants?.[variantIndex];
                    if (!variant)
                        continue;
                    const basePrice = variant.originalPrice ?? 0;
                    const dealPrice = Math.round(basePrice * (1 - data.discount / 100) * 100) / 100;
                    filteredVariants.push({
                        ...variant,
                        variantIndex,
                        dealPrice,
                        dealDiscountPercent: data.discount
                    });
                }
                if (filteredVariants.length === 0)
                    continue;
                let nearestExpiryDays = Infinity;
                for (const [, data] of dealVariantsMap) {
                    const daysToExpiry = Math.ceil((data.expiry.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysToExpiry < nearestExpiryDays)
                        nearestExpiryDays = daysToExpiry;
                }
                const dealPrices = filteredVariants.map((v) => v.dealPrice);
                const dealPrice = Math.min(...dealPrices);
                const clonedProduct = JSON.parse(JSON.stringify(product));
                expiringProducts.push({
                    ...clonedProduct,
                    dealVariants: filteredVariants,
                    isInDealPeriod: true,
                    dealPrice,
                    nearestExpiryDays
                });
            }
        }
        const sortBy = req.query.sortBy;
        if (sortBy === 'price-low' || sortBy === 'price-high') {
            expiringProducts.sort((a, b) => {
                const pricesA = (a.dealVariants || []).map((v) => v.dealPrice ?? v.offerPrice ?? v.originalPrice ?? 0);
                const pricesB = (b.dealVariants || []).map((v) => v.dealPrice ?? v.offerPrice ?? v.originalPrice ?? 0);
                const aPrice = pricesA.length > 0
                    ? sortBy === 'price-low'
                        ? Math.min(...pricesA)
                        : Math.max(...pricesA)
                    : (a.dealPrice ?? a.offerPrice ?? a.originalPrice ?? 0);
                const bPrice = pricesB.length > 0
                    ? sortBy === 'price-low'
                        ? Math.min(...pricesB)
                        : Math.max(...pricesB)
                    : (b.dealPrice ?? b.offerPrice ?? b.originalPrice ?? 0);
                return sortBy === 'price-low' ? aPrice - bPrice : bPrice - aPrice;
            });
        }
        else if (sortBy === 'name') {
            expiringProducts.sort((a, b) => a.name.localeCompare(b.name));
        }
        else {
            expiringProducts.sort((a, b) => (a.nearestExpiryDays ?? Infinity) - (b.nearestExpiryDays ?? Infinity));
        }
        const startIndex = (page - 1) * pageSize;
        const paginatedProducts = expiringProducts.slice(startIndex, startIndex + pageSize);
        res.json({
            products: paginatedProducts,
            page,
            pages: Math.ceil(expiringProducts.length / pageSize),
            total: expiringProducts.length
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getDealOfTheDayProducts = getDealOfTheDayProducts;
