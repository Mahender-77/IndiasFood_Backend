"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.registerSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.registerSchema = joi_1.default.object({
    username: joi_1.default.string().min(3).max(30).required(),
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(6).required(),
    phone: joi_1.default.string().optional(),
    addresses: joi_1.default.array().items(joi_1.default.object({
        address: joi_1.default.string().required(),
        city: joi_1.default.string().required(),
        postalCode: joi_1.default.string().required(),
        country: joi_1.default.string().required(),
    })).min(1).required(),
    role: joi_1.default.string().valid('user', 'admin', 'delivery').default('user').optional(),
});
exports.loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required(),
});
