"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCategorySchema = exports.createCategorySchema = exports.assignDeliveryPersonSchema = exports.updateOrderDeliverySchema = exports.updateOrderStatusSchema = exports.updateProductSchema = exports.createProductSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createProductSchema = joi_1.default.object({
    name: joi_1.default.string().required(),
    description: joi_1.default.string().required(),
    price: joi_1.default.number().min(0).required(),
    weight: joi_1.default.string().optional(),
    shelfLife: joi_1.default.string().optional(),
    category: joi_1.default.string().pattern(/^[0-9a-fA-F]{24}$/).required(), // Validate as ObjectId
    countInStock: joi_1.default.number().min(0).required(),
    videoUrl: joi_1.default.string().uri().allow('').optional(), // Optional video URL, allow empty string
    isActive: joi_1.default.boolean().optional(),
});
exports.updateProductSchema = joi_1.default.object({
    name: joi_1.default.string().optional(),
    description: joi_1.default.string().optional(),
    price: joi_1.default.number().min(0).optional(),
    weight: joi_1.default.string().optional(),
    shelfLife: joi_1.default.string().optional(),
    category: joi_1.default.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    countInStock: joi_1.default.number().min(0).optional(),
    videoUrl: joi_1.default.string().uri().optional(),
    images: joi_1.default.array().items(joi_1.default.string().uri()).optional(), // For updating images (e.g., removing old ones)
    isActive: joi_1.default.boolean().optional(),
});
exports.updateOrderStatusSchema = joi_1.default.object({
    status: joi_1.default.string().valid('placed', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled').required(),
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
});
exports.updateCategorySchema = joi_1.default.object({
    name: joi_1.default.string().min(3).max(50).optional(),
    isActive: joi_1.default.boolean().optional(),
});
