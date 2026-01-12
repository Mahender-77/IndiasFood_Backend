"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const UserSchema = new mongoose_1.default.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    addresses: [{
            address: { type: String, required: true },
            city: { type: String, required: true },
            postalCode: { type: String, required: true },
            country: { type: String, required: true },
        }],
    cart: [
        {
            product: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Product', required: true },
            qty: { type: Number, required: true, default: 1 },
        },
    ],
    wishlist: [
        { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Product' },
    ],
    deliveryProfile: {
        vehicleType: { type: String },
        licenseNumber: { type: String },
        areas: [{ type: String }],
        aadharCardImageUrl: { type: String },
        panCardImageUrl: { type: String },
        drivingLicenseImageUrl: { type: String },
        status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
    },
    isAdmin: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'admin', 'delivery'], default: 'user' },
}, { timestamps: true });
const User = mongoose_1.default.model('User', UserSchema);
exports.default = User;
