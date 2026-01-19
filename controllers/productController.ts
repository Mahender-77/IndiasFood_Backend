import { Request, Response } from 'express';
import Product from '../models/Product';
import Category from '../models/Category'; // Import Category model

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req: Request, res: Response) => {
  const pageSize = 10;
  const page = Number(req.query.pageNumber) || 1;
  
  // Handle both 'search' and 'keyword' query params for compatibility
  const searchTerm = (req.query.search || req.query.keyword) as string;
  const searchFilter = searchTerm
    ? { 
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ]
      }
    : {};

  let categoryFilter = {};
  if (req.query.category && req.query.category !== 'all' && req.query.category !== '') {
    // Case-insensitive category search
    const category = await Category.findOne({ 
      name: { $regex: new RegExp(`^${req.query.category}$`, 'i') } 
    });
    if (category) {
      categoryFilter = { category: category._id };
    } else {
      // If category not found by exact match, try partial match
      const partialCategory = await Category.findOne({ 
        name: { $regex: req.query.category as string, $options: 'i' } 
      });
      if (partialCategory) {
        categoryFilter = { category: partialCategory._id };
      } else {
        // If still not found, return empty products array
        return res.json({ products: [], page, pages: 0 });
      }
    }
  }

  let sort: { [key: string]: 1 | -1 } = { createdAt: -1 }; // Default to newest

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

  // Build final query - only include active products
  const query = { 
    ...searchFilter, 
    ...categoryFilter,
    isActive: true 
  };

  const count = await Product.countDocuments(query);
  const products = await Product.find(query)
    .populate('category', 'name') // Populate category name for frontend display
    .sort(sort)
    .limit(pageSize)
    .skip(pageSize * (page - 1));

  res.json({ products, page, pages: Math.ceil(count / pageSize) });
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id).populate('category', 'name');

  if (product) {
    const similarProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
    }).limit(3).populate('category', 'name');
    res.json({ product, similarProducts });
  } else {
    res.status(404).json({ message: 'Product not found' });
  }
};

// @desc    Fetch products by category 'sweets'
// @route   GET /api/products/category/sweets
// @access  Public
export const getSweetsProducts = async (req: Request, res: Response) => {
  const sweetsCategory = await Category.findOne({ name: 'Sweets' });

  if (sweetsCategory) {
    const products = await Product.find({ category: sweetsCategory._id }).populate('category', 'name');
    res.json(products);
  } else {
    res.json([]); // Return empty array if 'Sweets' category not found
  }
};

// @desc    Fetch all active categories
// @route   GET /api/products/categories
// @access  Public
export const getPublicCategories = async (req: Request, res: Response) => {
  try {
    const categories = await Category.find({});
    const categoriesWithImages = await Promise.all(categories.map(async (category) => {
      const productWithImage = await Product.findOne({ category: category._id, images: { $exists: true, $ne: [] } }).select('images').lean();
      return { ...category.toObject(), imageUrl: productWithImage?.images[0] || '/images/placeholder.png' };
    }));
    res.json(categoriesWithImages);
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