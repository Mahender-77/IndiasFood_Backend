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
    phone: { type: String },
    resetOTP: { type: String },
    resetOTPExpiry: { type: Date },
    resetOTPAttempts: { type: Number, default: 0 },
    newsletterSubscribed: { type: Boolean, default: false },
    // Enhanced addresses schema with full location data
    addresses: [{
            fullName: { type: String, required: true },
            phone: { type: String, required: true },
            addressLine1: { type: String, required: true },
            addressLine2: { type: String },
            city: { type: String, required: true },
            postalCode: { type: String, required: true },
            country: { type: String, required: true, default: 'India' },
            latitude: { type: Number, required: true },
            longitude: { type: Number, required: true },
            locationName: { type: String },
            isDefault: { type: Boolean, default: false }
        }],
    cart: [
        {
            product: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: 'Product',
                required: true
            },
            qty: {
                type: Number,
                required: true,
                min: 1,
                default: 1
            },
            selectedVariantIndex: {
                type: Number,
                default: 0,
                min: 0
            }
        }
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
    role: { type: String, enum: ['user', 'admin', 'delivery', 'delivery-pending'], default: 'user' },
}, { timestamps: true });
const User = mongoose_1.default.model('User', UserSchema);
exports.default = User;
