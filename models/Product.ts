import mongoose, { Document } from 'mongoose';

/**
 * Product Variant Interface
 * Supports different types of product variations (weight, pieces, box)
 * Each variant has its own pricing structure
 */
export interface IProductVariant {
  type: 'weight' | 'pieces' | 'box';      // Variant type classification
  value: string;                          // Variant value (e.g., "500g", "12pcs", "small")
  originalPrice: number;                  // Base price for this variant
  offerPrice?: number;                    // Optional discounted price
}

/**
 * Stock Information for Specific Variant at Location
 * Links variant by index to maintain referential integrity
 */
export interface IProductStock {
  variantIndex: number;                   // Index reference to variants array
  quantity: number;                       // Available stock quantity
  lowStockThreshold: number;              // Alert threshold for low stock
}

/**
 * Location-Based Inventory Structure
 * Supports multiple locations with multiple variants per location
 * Enables same variant in multiple locations and multiple variants per location
 */
export interface IProductInventory {
  location: string;                       // Location identifier (e.g., "hyderabad", "bangalore")
  stock: IProductStock[];                 // Array of variant stocks for this location
}

/**
 * Main Product Interface
 * Supports both single products and variant-based products
 * Flexible inventory management across multiple locations
 */
export interface IProduct {
  // Basic Information
  name: string;                           // Product name (required)
  description?: string;                   // Product description
  images: string[];                       // Array of image URLs
  videoUrl?: string;                      // Optional video URL
  shelfLife?: string;                     // Shelf life information

  // Pricing Structure (for backward compatibility with single products)
  originalPrice: number;                  // Base price (required for single products)
  offerPrice?: number;                    // Optional offer price

  // Variant System (optional - for products with multiple variations)
  variants?: IProductVariant[];           // Array of product variants

  // Marketing Flags
  isGITagged?: boolean;                   // GI (Geographical Indication) tagged
  isNewArrival?: boolean;                 // New arrival flag

  // Advanced Inventory Management
  inventory?: IProductInventory[];        // Location-based inventory with variants

  // Relations & Status
  category: mongoose.Types.ObjectId;      // Reference to category
  isActive: boolean;                      // Product active status
}

const ProductSchema = new mongoose.Schema<IProduct & Document>({
  // Basic Product Information
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  images: [{
    type: String,
    trim: true,
    validate: {
      validator: function(v: string) {
        // Basic URL validation
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Invalid image URL format'
    }
  }],
  videoUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v: string) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Invalid video URL format'
    }
  },
  shelfLife: {
    type: String,
    trim: true,
    maxlength: [50, 'Shelf life description too long']
  },

  // Pricing Structure
  originalPrice: {
    type: Number,
    required: function(this: IProduct & Document) {
      // Required only if no variants (single product pricing)
      return !this.variants || this.variants.length === 0;
    },
    min: [0, 'Price cannot be negative']
  },
  offerPrice: {
    type: Number,
    min: [0, 'Offer price cannot be negative']
  },

  // Variant System - Flexible product variations
  variants: [{
    type: {
      type: String,
      enum: {
        values: ['weight', 'pieces', 'box'],
        message: 'Variant type must be weight, pieces, or box'
      },
      required: true
    },
    value: {
      type: String,
      required: [true, 'Variant value is required'],
      trim: true,
      maxlength: [50, 'Variant value too long']
    },
    originalPrice: {
      type: Number,
      required: [true, 'Variant price is required'],
      min: [0, 'Variant price cannot be negative']
    },
    offerPrice: {
      type: Number,
      min: [0, 'Variant offer price cannot be negative']
    }
  }],

  // Marketing & Classification Flags
  isGITagged: { type: Boolean, default: false },
  isNewArrival: { type: Boolean, default: false },

  // Advanced Inventory Management - Location-wise & Variant-wise
  inventory: [{
    location: {
      type: String,
      required: [true, 'Location is required for inventory'],
      trim: true,
      lowercase: true, // Normalize location names
      maxlength: [50, 'Location name too long']
    },
    stock: [{
      variantIndex: {
        type: Number,
        required: [true, 'Variant index is required'],
        min: [0, 'Variant index cannot be negative']
      },
      quantity: {
        type: Number,
        default: 0,
        min: [0, 'Stock quantity cannot be negative']
      },
      lowStockThreshold: {
        type: Number,
        default: 5,
        min: [0, 'Low stock threshold cannot be negative']
      }
    }]
  }],

  // Relations & Status
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual field for total stock across all locations and variants
ProductSchema.virtual('countInStock').get(function(this: IProduct & Document) {
  if (!this.inventory || this.inventory.length === 0) return 0;

  return this.inventory.reduce((total, location) => {
    return total + location.stock.reduce((locationTotal, stockItem) => {
      return locationTotal + (stockItem.quantity || 0);
    }, 0);
  }, 0);
});

// Virtual field to get total locations count
ProductSchema.virtual('locationCount').get(function(this: IProduct & Document) {
  return this.inventory?.length || 0;
});

// Virtual field to get active variants count
ProductSchema.virtual('variantCount').get(function(this: IProduct & Document) {
  return this.variants?.length || 0;
});

// Instance method to get stock for specific location
ProductSchema.methods.getStockForLocation = function(location: string) {
  const locationInventory = this.inventory?.find(inv => inv.location === location);
  if (!locationInventory) return 0;

  return locationInventory.stock.reduce((total, stockItem) => {
    return total + (stockItem.quantity || 0);
  }, 0);
};

// Instance method to get stock for specific variant across all locations
ProductSchema.methods.getStockForVariant = function(variantIndex: number) {
  if (!this.inventory) return 0;

  return this.inventory.reduce((total, location) => {
    const variantStock = location.stock.find(stock => stock.variantIndex === variantIndex);
    return total + (variantStock?.quantity || 0);
  }, 0);
};

// Instance method to check if product is low on stock
ProductSchema.methods.isLowOnStock = function() {
  if (!this.inventory) return false;

  return this.inventory.some(location =>
    location.stock.some(stockItem =>
      stockItem.quantity <= stockItem.lowStockThreshold
    )
  );
};

// Static method to find products by location
ProductSchema.statics.findByLocation = function(location: string) {
  return this.find({
    'inventory.location': location,
    isActive: true
  }).populate('category');
};

// Static method to find low stock products
ProductSchema.statics.findLowStockProducts = function() {
  return this.find({
    isActive: true,
    inventory: {
      $elemMatch: {
        stock: {
          $elemMatch: {
            $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
          }
        }
      }
    }
  }).populate('category');
};

// Indexes for performance optimization
ProductSchema.index({ isActive: 1, category: 1 });                    // Active products by category
ProductSchema.index({ 'inventory.location': 1, isActive: 1 });         // Products by location
ProductSchema.index({ createdAt: -1 });                                // Recent products
ProductSchema.index({ name: 'text', description: 'text' });            // Text search

// Compound index for inventory queries
ProductSchema.index({
  'inventory.location': 1,
  'inventory.stock.variantIndex': 1,
  isActive: 1
});

// Pre-save middleware for data validation
ProductSchema.pre('save', async function () {
  const product = this as IProduct & Document;

  if (product.variants && product.variants.length > 0 && product.inventory) {
    const maxVariantIndex = product.variants.length - 1;

    for (const location of product.inventory) {
      for (const stock of location.stock) {
        if (stock.variantIndex > maxVariantIndex) {
          throw new Error(
            `Invalid variant index ${stock.variantIndex}. Max allowed: ${maxVariantIndex}`
          );
        }
      }
    }
  }
});


const Product = mongoose.model<IProduct & Document>('Product', ProductSchema);
export default Product;