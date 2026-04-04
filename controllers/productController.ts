import { Request, Response } from 'express';
import Category from '../models/Category';
import Product from '../models/Product';
import { expireStaleNewArrivalFlags } from '../utils/productNewArrival';

// @desc    Fetch all products with advanced filtering
// @route   GET /api/products
// @access  Public
export const getProducts = async (req: Request, res: Response) => {
  try {
    const isVariantInDeal = (product: any, variantIndex: number) => {
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      const inventory = product.inventory || [];

      for (const loc of inventory) {
        for (const batch of loc.batches || []) {
          if (batch.variantIndex !== variantIndex) continue;

          const triggerDays = batch.dealTriggerDays ?? product.dealTriggerDays ?? 0;
          const discount = batch.dealDiscountPercent ?? product.dealDiscountPercent ?? 0;

          if (triggerDays <= 0 || discount <= 0) continue;

          const expiry = new Date(batch.expiryDate);
          expiry.setHours(0, 0, 0, 0);

          const dealStart = new Date(expiry);
          dealStart.setDate(dealStart.getDate() - triggerDays);

          if (
            currentDate >= dealStart &&
            currentDate <= expiry &&
            (batch.quantity || 0) > 0
          ) {
            return true;
          }
        }
      }

      return false;
    };

    const filterDealVariantsFromListing = (rawProducts: any[]) =>
      rawProducts
        .map((product: any) => {
          if (!product.variants || product.variants.length === 0) return product;

          const filteredVariants = product.variants.filter((_: any, index: number) => {
            return !isVariantInDeal(product, index);
          });

          return {
            ...product,
            variants: filteredVariants
          };
        })
        .filter((product: any) => {
          return !product.variants || product.variants.length > 0;
        });

    const pageSize = 12;
    const page = Number(req.query.pageNumber) || 1;

    /* ---------------- SEARCH FILTER ---------------- */

    const searchTerm = (req.query.search || req.query.keyword) as string;

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
    if (
      req.query.category &&
      req.query.category !== "all" &&
      req.query.category !== ""
    ) {
      const category = await Category.findOne({
        name: { $regex: new RegExp(`^${req.query.category}$`, "i") },
      });

      if (category) {
        categoryFilter = { category: category._id };
      } else {
        return res.json({ products: [], page, pages: 0 });
      }
    }

    /* ---------------- SUBCATEGORY FILTER ---------------- */

    let subcategoryFilter = {};
    if (req.query.subcategories) {
      const subcategories = (req.query.subcategories as string)
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

    const sortBy = req.query.sortBy as string;

    /* =====================================================
       🔥 PRICE SORTING (VARIANT + NON VARIANT SAFE)
    ====================================================== */

    if (sortBy === "price-low" || sortBy === "price-high") {
      const sortDirection = sortBy === "price-low" ? 1 : -1;

      const rawProducts = await Product.aggregate([
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

      const count = await Product.countDocuments(query);

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

    let sort: { [key: string]: 1 | -1 } = { createdAt: -1 };

    switch (sortBy) {
      case "name":
        sort = { name: 1 };
        break;

      case "featured":
      default:
        sort = { createdAt: -1 };
        break;
    }

    const count = await Product.countDocuments(query);

    const rawProducts = await Product.find(query)
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name');

    if (product) {
      const similarProducts = await Product.find({
        category: product.category,
        _id: { $ne: product._id },
        isActive: true
      }).limit(3).populate('category', 'name');
      res.json({ product, similarProducts });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch products by category 'sweets'
// @route   GET /api/products/category/sweets
// @access  Public
export const getSweetsProducts = async (req: Request, res: Response) => {
  try {
    const sweetsCategory = await Category.findOne({ name: 'Sweets' });

    if (sweetsCategory) {
      const products = await Product.find({ 
        category: sweetsCategory._id,
        isActive: true 
      }).populate('category', 'name');
      res.json(products);
    } else {
      res.json([]);
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch all active categories with subcategories
// @route   GET /api/products/categories
// @access  Public
export const getPublicCategories = async (req: Request, res: Response) => {
  try {
    const categories = await Category.find({ isActive: true });
    const categoriesWithImages = await Promise.all(categories.map(async (category) => {
      const productWithImage = await Product.findOne({ 
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch all subcategories for a category
// @route   GET /api/products/subcategories/:categoryName
// @access  Public
export const getSubcategoriesByCategory = async (req: Request, res: Response) => {
  try {
    const categoryName = req.params.categoryName;
    const category = await Category.findOne({ 
      name: { $regex: new RegExp(`^${categoryName}$`, 'i') },
      isActive: true 
    });

    if (category && category.subcategories) {
      const activeSubcategories = category.subcategories.filter(sub => sub.isActive);
      res.json(activeSubcategories);
    } else {
      res.json([]);
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch all unique subcategories across all categories
// @route   GET /api/products/all-subcategories
// @access  Public
export const getAllSubcategories = async (req: Request, res: Response) => {
  try {
    const categories = await Category.find({ isActive: true });
    
    const allSubcategories: any[] = [];
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch GI Tagged products
// @route   GET /api/products/gi-tagged
// @access  Public
export const getGITaggedProducts = async (req: Request, res: Response) => {
  try {
    const pageSize = 12;
    const page = Number(req.query.pageNumber) || 1;
    
    const searchTerm = (req.query.search || req.query.keyword) as string;
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
      const subcategories = (req.query.subcategories as string).split(',').map(s => s.trim());
      if (subcategories.length > 0) {
        subcategoryFilter = { subcategory: { $in: subcategories } };
      }
    }

    let sort: { [key: string]: 1 | -1 } = { createdAt: -1 };
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

    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name')
      .sort(sort)
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    res.json({ products, page, pages: Math.ceil(count / pageSize) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch New Arrival products
// @route   GET /api/products/new-arrivals
// @access  Public
export const getNewArrivalProducts = async (req: Request, res: Response) => {
  try {
    await expireStaleNewArrivalFlags();

    const pageSize = 12;
    const page = Number(req.query.pageNumber) || 1;
    
    const searchTerm = (req.query.search || req.query.keyword) as string;
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
      const subcategories = (req.query.subcategories as string).split(',').map(s => s.trim());
      if (subcategories.length > 0) {
        subcategoryFilter = { subcategory: { $in: subcategories } };
      }
    }

    let sort: { [key: string]: 1 | -1 } = { createdAt: -1 };
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

    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name')
      .sort(sort)
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    res.json({ products, page, pages: Math.ceil(count / pageSize) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch Most Sold products
// @route   GET /api/products/most-saled
// @access  Public
export const getMostSoldProducts = async (req: Request, res: Response) => {
  try {
    const pageSize = 12;
    const page = Number(req.query.pageNumber) || 1;
    
    const searchTerm = (req.query.search || req.query.keyword) as string;
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
      const subcategories = (req.query.subcategories as string).split(',').map(s => s.trim());
      if (subcategories.length > 0) {
        subcategoryFilter = { subcategory: { $in: subcategories } };
      }
    }

    let sort: { [key: string]: 1 | -1 } = { createdAt: -1 };
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

    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name')
      .sort(sort)
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    res.json({ products, page, pages: Math.ceil(count / pageSize) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch Deal of the Day products (per-batch deal logic, FIFO-friendly)
// Each batch has its own dealTriggerDays & dealDiscountPercent (see Product.batches).
// When a batch is within its trigger days of expiry and not yet expired, that variant
// qualifies; we keep the best (max) discount per variant. Full `variants` are preserved;
// `dealVariants` lists only variants in the deal window (with dealPrice / dealDiscountPercent).
// Fallback: product-level dealTriggerDays/dealDiscountPercent when batch has none.
// @route   GET /api/products/deal-of-the-day
// @access  Public
export const getDealOfTheDayProducts = async (req: Request, res: Response) => {
  try {
    const pageSize = Number(req.query.pageSize) || 10;
    const page = Number(req.query.pageNumber) || 1;
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const allProducts = await Product.find({ isActive: true })
      .populate('category', 'name')
      .lean();

    const expiringProducts: any[] = [];

    for (const product of allProducts) {
      const productTriggerDays = (product as any).dealTriggerDays ?? 0;
      const productDiscountPercent = (product as any).dealDiscountPercent ?? 0;

      const dealVariantsMap = new Map<number, { discount: number; expiry: Date }>();

      const inventory = (product as any).inventory || [];
      for (const loc of inventory) {
        for (const batch of loc.batches || []) {
          const triggerDays = (batch as any).dealTriggerDays ?? productTriggerDays;
          const batchDiscount = (batch as any).dealDiscountPercent ?? productDiscountPercent;

          if (triggerDays <= 0 || batchDiscount <= 0) continue;

          const batchExpiry = new Date(batch.expiryDate);
          batchExpiry.setHours(0, 0, 0, 0);

          const dealStartDate = new Date(batchExpiry);
          dealStartDate.setDate(dealStartDate.getDate() - triggerDays);

          if (
            currentDate >= dealStartDate &&
            currentDate <= batchExpiry &&
            (batch.quantity || 0) > 0
          ) {
            const variantIndex = (batch as any).variantIndex ?? 0;

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
        const filteredVariants: any[] = [];

        for (const [variantIndex, data] of dealVariantsMap.entries()) {
          const variant = (product as any).variants?.[variantIndex];
          if (!variant) continue;

          const basePrice = variant.originalPrice ?? 0;
          const dealPrice = Math.round(basePrice * (1 - data.discount / 100) * 100) / 100;

          filteredVariants.push({
            ...variant,
            variantIndex,
            dealPrice,
            dealDiscountPercent: data.discount
          });
        }

        if (filteredVariants.length === 0) continue;

        let nearestExpiryDays = Infinity;
        for (const [, data] of dealVariantsMap) {
          const daysToExpiry = Math.ceil(
            (data.expiry.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysToExpiry < nearestExpiryDays) nearestExpiryDays = daysToExpiry;
        }

        const dealPrices = filteredVariants.map((v: any) => v.dealPrice);
        const dealPrice = Math.min(...dealPrices);

        const clonedProduct = JSON.parse(JSON.stringify(product)) as any;

        expiringProducts.push({
          ...clonedProduct,
          dealVariants: filteredVariants,
          isInDealPeriod: true,
          dealPrice,
          nearestExpiryDays
        });
      }
    }

    const sortBy = req.query.sortBy as string;
    if (sortBy === 'price-low' || sortBy === 'price-high') {
      expiringProducts.sort((a: any, b: any) => {
        const pricesA = (a.dealVariants || []).map(
          (v: any) => v.dealPrice ?? v.offerPrice ?? v.originalPrice ?? 0
        );
        const pricesB = (b.dealVariants || []).map(
          (v: any) => v.dealPrice ?? v.offerPrice ?? v.originalPrice ?? 0
        );
        const aPrice =
          pricesA.length > 0
            ? sortBy === 'price-low'
              ? Math.min(...pricesA)
              : Math.max(...pricesA)
            : (a.dealPrice ?? a.offerPrice ?? a.originalPrice ?? 0);
        const bPrice =
          pricesB.length > 0
            ? sortBy === 'price-low'
              ? Math.min(...pricesB)
              : Math.max(...pricesB)
            : (b.dealPrice ?? b.offerPrice ?? b.originalPrice ?? 0);
        return sortBy === 'price-low' ? aPrice - bPrice : bPrice - aPrice;
      });
    } else if (sortBy === 'name') {
      expiringProducts.sort((a: any, b: any) => a.name.localeCompare(b.name));
    } else {
      expiringProducts.sort((a: any, b: any) =>
        (a.nearestExpiryDays ?? Infinity) - (b.nearestExpiryDays ?? Infinity)
      );
    }

    const startIndex = (page - 1) * pageSize;
    const paginatedProducts = expiringProducts.slice(startIndex, startIndex + pageSize);

    res.json({
      products: paginatedProducts,
      page,
      pages: Math.ceil(expiringProducts.length / pageSize),
      total: expiringProducts.length
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
