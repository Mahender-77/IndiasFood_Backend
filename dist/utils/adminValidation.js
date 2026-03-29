"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCategorySchema = exports.createCategorySchema = exports.assignDeliveryPersonSchema = exports.updateOrderDeliverySchema = exports.updateOrderStatusSchema = exports.updateProductSchema = exports.createProductSchema = exports.addBatchesSchema = exports.createProductBasicSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const batchSchema = joi_1.default.object({
    batchNumber: joi_1.default.string().required(),
    quantity: joi_1.default.number().min(0).required(),
    manufacturingDate: joi_1.default.date().required(),
    expiryDate: joi_1.default.date().required(),
    purchasePrice: joi_1.default.number().min(0).required(),
    sellingPrice: joi_1.default.number().min(0).required(),
    variantIndex: joi_1.default.number().min(0).required(),
});
const stockSchema = joi_1.default.object({
    variantIndex: joi_1.default.number().min(0).required(),
    quantity: joi_1.default.number().min(0).required(),
    lowStockThreshold: joi_1.default.number().min(0).optional(),
});
const inventoryItemSchema = joi_1.default.object({
    location: joi_1.default.string().required(),
    batches: joi_1.default.array().items(batchSchema).optional(),
    stock: joi_1.default.array().items(stockSchema).optional(),
}).or('batches', 'stock');
/** Step 1: Basic product creation only - no store, no price, no deal */
exports.createProductBasicSchema = joi_1.default.object({
    name: joi_1.default.string().required().max(100),
    description: joi_1.default.string().optional().max(1000),
    category: joi_1.default.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    subcategory: joi_1.default.string().optional().max(100),
    videoUrl: joi_1.default.string().uri().allow('').optional(),
    images: joi_1.default.array().items(joi_1.default.string().uri()).optional(),
    originLocation: joi_1.default.string().optional().max(100),
    isGITagged: joi_1.default.boolean().optional(),
    isNewArrival: joi_1.default.boolean().optional(),
    isMostSaled: joi_1.default.boolean().optional(),
    isActive: joi_1.default.boolean().optional(),
}).options({ stripUnknown: true });
/** Add batches payload - Step 2/3: store, pricing, variants, batches (each batch has its own deal) */
const batchInputSchema = joi_1.default.object({
    location: joi_1.default.string().required().lowercase(),
    batchNumber: joi_1.default.string().required(),
    manufacturingDate: joi_1.default.date().required(),
    expiryDate: joi_1.default.date().required().greater(joi_1.default.ref('manufacturingDate')),
    purchasePrice: joi_1.default.number().min(0).required(),
    sellingPrice: joi_1.default.number().min(0).required(),
    variantIndex: joi_1.default.number().min(0).optional(),
    quantity: joi_1.default.number().min(0).required(),
    batchWholePrice: joi_1.default.number().min(0).optional(),
    dealTriggerDays: joi_1.default.number().min(0).optional(),
    dealDiscountPercent: joi_1.default.number().min(0).max(100).optional(),
});
exports.addBatchesSchema = joi_1.default.object({
    store: joi_1.default.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    originalPrice: joi_1.default.number().min(0).optional(),
    offerPrice: joi_1.default.number().min(0).optional(),
    addVariants: joi_1.default.array().items(joi_1.default.object({
        type: joi_1.default.string().valid('weight', 'pieces', 'box').required(),
        value: joi_1.default.string().required(),
        originalPrice: joi_1.default.number().min(0).required(),
        offerPrice: joi_1.default.number().min(0).optional(),
    })).optional(),
    batches: joi_1.default.array().items(batchInputSchema).min(1).required(),
});
exports.createProductSchema = joi_1.default.object({
    name: joi_1.default.string().required(),
    description: joi_1.default.string().optional(),
    originalPrice: joi_1.default.number().min(0).optional(),
    offerPrice: joi_1.default.number().min(0).optional(),
    variants: joi_1.default.array().items(joi_1.default.object({
        type: joi_1.default.string().valid('weight', 'pieces', 'box').required(),
        value: joi_1.default.string().required(),
        originalPrice: joi_1.default.number().min(0).required(),
        offerPrice: joi_1.default.number().min(0).optional(),
    })).optional(),
    category: joi_1.default.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    store: joi_1.default.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    inventory: joi_1.default.array().items(inventoryItemSchema).optional(),
    videoUrl: joi_1.default.string().uri().allow('').optional(),
    images: joi_1.default.array().items(joi_1.default.string().uri()).optional(),
    isActive: joi_1.default.boolean().optional(),
    isGITagged: joi_1.default.boolean().optional(),
    isNewArrival: joi_1.default.boolean().optional(),
    dealTriggerDays: joi_1.default.number().min(0).optional(),
    dealDiscountPercent: joi_1.default.number().min(0).max(100).optional(),
});
exports.updateProductSchema = joi_1.default.object({
    name: joi_1.default.string().optional(),
    description: joi_1.default.string().optional(),
    originalPrice: joi_1.default.number().min(0).optional(),
    offerPrice: joi_1.default.number().min(0).optional(),
    variants: joi_1.default.array().items(joi_1.default.object({
        type: joi_1.default.string().valid('weight', 'pieces', 'box').required(),
        value: joi_1.default.string().required(),
        originalPrice: joi_1.default.number().min(0).required(),
        offerPrice: joi_1.default.number().min(0).optional(),
    })).optional(),
    category: joi_1.default.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    inventory: joi_1.default.array().items(inventoryItemSchema).optional(),
    videoUrl: joi_1.default.string().uri().optional(),
    images: joi_1.default.array().items(joi_1.default.string().uri()).optional(),
    isActive: joi_1.default.boolean().optional(),
    isGITagged: joi_1.default.boolean().optional(),
    isNewArrival: joi_1.default.boolean().optional(),
});
exports.updateOrderStatusSchema = joi_1.default.object({
    status: joi_1.default.string().valid('placed', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled').required(),
    cancelReason: joi_1.default.string().when('status', {
        is: 'cancelled',
        then: joi_1.default.string().min(1).max(500).required(),
        otherwise: joi_1.default.string().optional()
    }),
});
exports.updateOrderDeliverySchema = joi_1.default.object({
    isDelivered: joi_1.default.boolean().required(),
});
exports.assignDeliveryPersonSchema = joi_1.default.object({
    deliveryPersonId: joi_1.default.string().required(),
    eta: joi_1.default.string().required(),
});
exports.createCategorySchema = joi_1.default.object({
    name: joi_1.default.string().min(3).max(50).required(),
    isActive: joi_1.default.boolean().optional(),
    subcategories: joi_1.default.array().items(joi_1.default.object({
        name: joi_1.default.string().min(1).max(50).required(),
        isActive: joi_1.default.boolean().optional(),
    })).optional(),
});
exports.updateCategorySchema = joi_1.default.object({
    name: joi_1.default.string().min(3).max(50).optional(),
    isActive: joi_1.default.boolean().optional(),
    subcategories: joi_1.default.array().items(joi_1.default.object({
        name: joi_1.default.string().min(1).max(50).required(),
        isActive: joi_1.default.boolean().optional(),
    })).optional(),
});
