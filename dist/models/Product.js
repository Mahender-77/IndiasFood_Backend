"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVariantQuantityAtLocation = getVariantQuantityAtLocation;
const mongoose_1 = __importDefault(require("mongoose"));
/* ---------------- SCHEMA ---------------- */
const ProductBatchSchema = new mongoose_1.default.Schema({
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
}, { _id: false });
const ProductStockSchema = new mongoose_1.default.Schema({
    variantIndex: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 }
}, { _id: false });
const ProductSchema = new mongoose_1.default.Schema({
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
                validator: (v) => /^https?:\/\/.+/.test(v),
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
        type: mongoose_1.default.Schema.Types.ObjectId,
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
        type: mongoose_1.default.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
/* ---------------- VIRTUALS ---------------- */
/** Total stock across all locations & variants (from batches or legacy stock). Excludes inactive variants. */
ProductSchema.virtual('countInStock').get(function () {
    if (!this.inventory)
        return 0;
    const variants = this.variants || [];
    const isVariantActive = (i) => variants[i]?.isActive !== false;
    return this.inventory.reduce((total, loc) => {
        if (loc.batches && loc.batches.length > 0) {
            return total + loc.batches.reduce((sum, b) => {
                if (!isVariantActive(b.variantIndex))
                    return sum;
                return sum + (b.quantity || 0);
            }, 0);
        }
        if (loc.stock && loc.stock.length > 0) {
            return total + loc.stock.reduce((sum, s) => {
                if (!isVariantActive(s.variantIndex))
                    return sum;
                return sum + (s.quantity || 0);
            }, 0);
        }
        return total;
    }, 0);
});
/* ---------------- HELPER: Get total quantity for variant at location (from batches or stock) */
function getVariantQuantityAtLocation(inv, variantIndex) {
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
const Product = mongoose_1.default.model('Product', ProductSchema);
exports.default = Product;
