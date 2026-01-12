"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrderSchema = exports.wishlistToggleSchema = exports.cartUpdateSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.cartUpdateSchema = joi_1.default.object({
    productId: joi_1.default.string().required(),
    qty: joi_1.default.number().min(0).required(),
});
exports.wishlistToggleSchema = joi_1.default.object({
    productId: joi_1.default.string().required(),
});
exports.createOrderSchema = joi_1.default.object({
    orderItems: joi_1.default.array().items(joi_1.default.object({
        name: joi_1.default.string().required(),
        qty: joi_1.default.number().min(1).required(),
        image: joi_1.default.string().required(),
        price: joi_1.default.number().required(),
        product: joi_1.default.string().required(),
    })).min(1).required(),
    shippingAddress: joi_1.default.object({
        address: joi_1.default.string().required(),
        city: joi_1.default.string().required(),
        postalCode: joi_1.default.string().required(),
        country: joi_1.default.string().required(),
    }).required(),
    paymentMethod: joi_1.default.string().required(),
    taxPrice: joi_1.default.number().required(),
    shippingPrice: joi_1.default.number().required(),
    totalPrice: joi_1.default.number().required(),
});
