"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const StoreLocationSchema = new mongoose_1.default.Schema({
    storeId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        default: () => new mongoose_1.default.Types.ObjectId(), // 🔥 AUTO-GENERATE
        index: true
    },
    name: {
        type: String,
        required: [true, 'Store name is required'],
        trim: true
    },
    contact_number: {
        type: String,
        required: [true, 'Contact number is required'],
        trim: true
    },
    address: {
        type: String,
        required: [true, 'Store address is required'],
        trim: true
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true
    },
    latitude: {
        type: Number,
        required: [true, 'Latitude is required'],
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
        type: Number,
        required: [true, 'Longitude is required'],
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { _id: false });
const DeliverySettingsSchema = new mongoose_1.default.Schema({
    pricePerKm: {
        type: Number,
        required: true,
        default: 10,
        min: 0
    },
    baseCharge: {
        type: Number,
        required: true,
        default: 50,
        min: 0
    },
    freeDeliveryThreshold: {
        type: Number,
        required: true,
        default: 500,
        min: 0
    },
    storeLocations: {
        type: [StoreLocationSchema],
        default: [],
        validate: {
            validator: function (v) {
                // At least one active store required
                return v.length > 0 && v.some(store => store.isActive);
            },
            message: 'At least one active store location is required'
        }
    }
}, { timestamps: true });
const DeliverySettings = mongoose_1.default.model('DeliverySettings', DeliverySettingsSchema);
exports.default = DeliverySettings;
