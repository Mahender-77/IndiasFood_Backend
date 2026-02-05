"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const uploadController_1 = require("../controllers/uploadController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
/**
 * Generate Cloudinary Signature
 */
// router.post(
//   '/cloudinary-sign',
//   protect,
//   generateCloudinarySignature
// );
/**
 * Upload Images Route
 * Flow:
 * 1. protect (auth)
 * 2. debug before multer
 * 3. multer (upload.array)
 * 4. debug after multer
 * 5. controller
 */
router.post('/images', 
// 🔐 Authentication
auth_1.protect, 
// 📤 Multer middleware
uploadController_1.uploadArray, 
// ☁️ BunnyCDN upload handler
uploadController_1.uploadImages);
exports.default = router;
