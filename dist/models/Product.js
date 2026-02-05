"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
/* ---------------- SCHEMA ---------------- */
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
    shelfLife: {
        type: String,
        trim: true,
        maxlength: 50
    },
    /* ---------- 🔥 STORE (VERY IMPORTANT) ---------- */
    store: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'DeliverySettings', // or 'Store' if you split later
        required: true,
        index: true
    },
    /* ---------- PRICING ---------- */
    originalPrice: {
        type: Number,
        min: 0,
        required: function () {
            // Required ONLY for non-variant products
            return !this.variants || this.variants.length === 0;
        }
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
    /* ---------- INVENTORY ---------- */
    inventory: [
        {
            location: {
                type: String,
                required: true,
                trim: true,
                lowercase: true
            },
            stock: [
                {
                    variantIndex: {
                        type: Number,
                        required: true,
                        min: 0
                    },
                    quantity: {
                        type: Number,
                        default: 0,
                        min: 0
                    },
                    lowStockThreshold: {
                        type: Number,
                        default: 5,
                        min: 0
                    }
                }
            ]
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
/** 🔢 Total stock across all locations & variants */
ProductSchema.virtual('countInStock').get(function () {
    if (!this.inventory)
        return 0;
    return this.inventory.reduce((total, loc) => total +
        loc.stock.reduce((sum, s) => sum + (s.quantity || 0), 0), 0);
});
/* ---------------- INDEXES ---------------- */
ProductSchema.index({ store: 1, isActive: 1 });
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ 'inventory.location': 1, isActive: 1 });
ProductSchema.index({ name: 'text', description: 'text' });
/* ---------------- VALIDATION ---------------- */
/** 🔐 Prevent invalid variantIndex values */
ProductSchema.pre('save', function () {
    if (this.variants && this.inventory) {
        const maxIndex = this.variants.length - 1;
        this.inventory.forEach(loc => {
            loc.stock.forEach(s => {
                if (s.variantIndex > maxIndex) {
                    throw new Error(`Invalid variantIndex ${s.variantIndex}`);
                }
            });
        });
    }
});
const Product = mongoose_1.default.model('Product', ProductSchema);
exports.default = Product;
