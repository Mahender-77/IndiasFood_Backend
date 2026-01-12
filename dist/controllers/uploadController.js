"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCloudinarySignature = void 0;
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const generateCloudinarySignature = async (req, res) => {
    try {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const signature = cloudinary_1.default.utils.api_sign_request({ timestamp: timestamp, folder: 'indias-food' }, process.env.CLOUDINARY_API_SECRET);
        res.status(200).json({
            signature,
            timestamp,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.generateCloudinarySignature = generateCloudinarySignature;
