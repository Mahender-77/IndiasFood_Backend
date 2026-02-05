import { Request, Response } from 'express';
import Category from '../models/Category';
import Product from '../models/Product';

// @desc    Fetch all products with advanced filtering
// @route   GET /api/products
// @access  Public
export const getProducts = async (req: Request, res: Response) => {
  try {
    const pageSize = 12;
    const page = Number(req.query.pageNumber) || 1;
    
    // Search term handling
    const searchTerm = (req.query.search || req.query.keyword) as string;
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
      const category = await Category.findOne({ 
        name: { $regex: new RegExp(`^${req.query.category}$`, 'i') } 
      });
      if (category) {
        categoryFilter = { category: category._id };
      } else {
        return res.json({ products: [], page, pages: 0 });
      }
    }

    // Subcategory filter (NEW)
    let subcategoryFilter = {};
    if (req.query.subcategories) {
      // Handle multiple subcategories (comma-separated)
      const subcategories = (req.query.subcategories as string).split(',').map(s => s.trim());
      if (subcategories.length > 0) {
        subcategoryFilter = { 
          subcategory: { $in: subcategories }
        };
      }
    }

    // Sorting logic
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