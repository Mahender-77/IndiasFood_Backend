"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const ProductSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    weight: { type: String }, // ADD "250g"
    shelfLife: { type: String }, // ADD "7 days"  
    countInStock: { type: Number, required: true, default: 0 },
    images: [{ type: String, required: true }],
    videoUrl: { type: String }, // Optional field for product video URL
    category: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Category', required: true },
    isActive: { type: Boolean, default: true } // ADD
}, { timestamps: true });
const Product = mongoose_1.default.model('Product', ProductSchema);
exports.default = Product;
