import mongoose, { Document } from 'mongoose';

/* ---------------- INTERFACES ---------------- */

export interface IProductVariant {
  type: 'weight' | 'pieces' | 'box';
  value: string;
  originalPrice: number;
  offerPrice?: number;
  /** When false, this variant's batch quantity is excluded from total/available stock (not deleted). */
  isActive?: boolean;
}

export interface IProductStock {
  variantIndex: number;
  quantity: number;
  lowStockThreshold: number;
}

/** Batch-based inventory entry for tracking stock per batch */
export interface IProductBatch {
  batchNumber: string;
  quantity: number;
  manufacturingDate: Date;
  expiryDate: Date;
  purchasePrice: number;
  sellingPrice: number;
  variantIndex: number;
  /** How many units were deducted from this batch specifically as GiveAway (Deal-of-the-day). */
  giveAwayQuantity?: number;
  /** Total units sold (deducted from this batch via paid orders). */
  soldQuantity?: number;
  /** Total revenue realised from this batch sales. */
  revenue?: number;
  /** Original batch quantity before any deductions (sales + giveaways). */
  initialQuantity?: number;
  /** Total/cost value for the whole batch (e.g. total purchase cost of this batch) */
  batchWholePrice?: number;
  /** Per-batch Deal of the Day: days before expiry when deal activates */
  dealTriggerDays?: number;
  /** Per-batch Deal of the Day: discount percent when in deal period */
  dealDiscountPercent?: number;
}

export interface IProductInventory {
  location: string;
  /** New: batch-based inventory. Total quantity = sum of batch quantities. */
  batches?: IProductBatch[];
  /** Legacy: flat stock (for backward compatibility). Prefer batches for new products. */
  stock?: IProductStock[];
}

export interface IProduct {
  name: string;
  description?: string;
  images: string[];
  videoUrl?: string;

  originLocation?: string;

  /** 🔥 STORE OWNERSHIP */
  store: mongoose.Types.ObjectId;

  originalPrice?: number;
  offerPrice?: number;

  variants?: IProductVariant[];

  isGITagged?: boolean;
  isNewArrival?: boolean;
  isMostSaled?: boolean;

  /** Deal of the Day: when batch is (expiryDate - dealTriggerDays) away from expiry, auto-include with dealDiscountPercent */
  dealTriggerDays?: number;
  dealDiscountPercent?: number;

  inventory?: IProductInventory[];

  category: mongoose.Types.ObjectId;
  subcategory?: string;
  isActive: boolean;
}

/* ---------------- SCHEMA ---------------- */

const ProductBatchSchema = new mongoose.Schema(
  {
    batchNumber: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    manufacturingDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    purchasePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    variantIndex: { type: Number, required: true, min: 0 },
    giveAwayQuantity: { type: Number, default: 0, min: 0 },
    soldQuantity: { type: Number, default: 0, min: 0 },
    revenue: { type: Number, default: 0, min: 0 },
    initialQuantity: { type: Number, min: 0, default: undefined },
    batchWholePrice: { type: Number, min: 0, default: undefined },
    dealTriggerDays: { type: Number, min: 0, default: undefined },
    dealDiscountPercent: { type: Number, min: 0, max: 100, default: undefined }
  },
  { _id: false }
);

const ProductStockSchema = new mongoose.Schema(
  {
    variantIndex: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 }
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema<IProduct & Document>(
  {
    /* ---------- BASIC INFO ---------- */

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },

    images: [
      {
        type: String,
        trim: true,
        validate: {
          validator: (v: string) => /^https?:\/\/.+/.test(v),
          message: 'Invalid image URL'
        }
      }
    ],

    videoUrl: {
      type: String,
      trim: true
    },

    originLocation: {
      type: String,
      trim: true,
      maxlength: 100,
      index: true
    },

    /* ---------- 🔥 STORE (VERY IMPORTANT) ---------- */

    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliverySettings',
      required: false,
      index: true
    },

    /* ---------- PRICING ---------- */

    originalPrice: {
      type: Number,
      min: 0
    },

    offerPrice: {
      type: Number,
      min: 0
    },

    /* ---------- VARIANTS ---------- */

    variants: [
      {
        type: {
          type: String,
          enum: ['weight', 'pieces', 'box'],
          required: true
        },
        value: {
          type: String,
          required: true,
          trim: true
        },
        originalPrice: {
          type: Number,
          required: true,
          min: 0
        },
        offerPrice: {
          type: Number,
          min: 0
        },
        isActive: {
          type: Boolean,
          default: true
        }
      }
    ],

    /* ---------- FLAGS ---------- */

    isGITagged: {
      type: Boolean,
      default: false
    },

    isNewArrival: {
      type: Boolean,
      default: false
    },

    isMostSaled: {
      type: Boolean,
      default: false
    },

    dealTriggerDays: {
      type: Number,
      min: 0,
      default: undefined
    },
    dealDiscountPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: undefined
    },

    /* ---------- INVENTORY (Batch-based + Legacy stock) ---------- */

    inventory: [
      {
        location: {
          type: String,
          required: true,
          trim: true,
          lowercase: true
        },
        batches: [ProductBatchSchema],
        stock: [ProductStockSchema]
      }
    ],

    /* ---------- RELATIONS ---------- */

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },

    subcategory: {
      type: String,
      trim: true
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/* ---------------- VIRTUALS ---------------- */

/** Total stock across all locations & variants (from batches or legacy stock). Excludes inactive variants. */
ProductSchema.virtual('countInStock').get(function () {
  if (!this.inventory) return 0;
  const variants = this.variants || [];
  const isVariantActive = (i: number) => (variants[i] as any)?.isActive !== false;

  return this.inventory.reduce((total, loc) => {
    if (loc.batches && loc.batches.length > 0) {
      return total + loc.batches.reduce((sum, b) => {
        if (!isVariantActive(b.variantIndex)) return sum;
        return sum + (b.quantity || 0);
      }, 0);
    }
    if (loc.stock && loc.stock.length > 0) {
      return total + loc.stock.reduce((sum, s) => {
        if (!isVariantActive(s.variantIndex)) return sum;
        return sum + (s.quantity || 0);
      }, 0);
    }
    return total;
  }, 0);
});

/* ---------------- HELPER: Get total quantity for variant at location (from batches or stock) */
export function getVariantQuantityAtLocation(inv: IProductInventory, variantIndex: number): number {
  if (inv.batches && inv.batches.length > 0) {
    return inv.batches
      .filter(b => b.variantIndex === variantIndex)
      .reduce((sum, b) => sum + (b.quantity || 0), 0);
  }
  if (inv.stock && inv.stock.length > 0) {
    const s = inv.stock.find(st => st.variantIndex === variantIndex);
    return s ? (s.quantity || 0) : 0;
  }
  return 0;
}

/* ---------------- INDEXES ---------------- */

ProductSchema.index({ store: 1, isActive: 1 });
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ 'inventory.location': 1, isActive: 1 });
ProductSchema.index({ name: 'text', description: 'text' });

/* ---------------- VALIDATION ---------------- */

ProductSchema.pre('save', function () {
  const maxVariantIndex = this.variants && this.variants.length > 0 ? this.variants.length - 1 : 0;

  this.inventory?.forEach(loc => {
    if (loc.batches && loc.batches.length > 0) {
      loc.batches.forEach(b => {
        if (b.variantIndex < 0 || b.variantIndex > maxVariantIndex) {
          throw new Error(`Invalid variantIndex ${b.variantIndex} in batch`);
        }
      });
    }
    if (loc.stock && loc.stock.length > 0) {
      loc.stock.forEach(s => {
        if (s.variantIndex < 0 || s.variantIndex > maxVariantIndex) {
          throw new Error(`Invalid variantIndex ${s.variantIndex} in stock`);
        }
      });
    }
  });
});

const Product = mongoose.model<IProduct & Document>('Product', ProductSchema);
export default Product;
