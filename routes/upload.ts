import express from 'express';
import {
  generateCloudinarySignature,
  uploadImages,
  uploadArray
} from '../controllers/uploadController';
import { protect } from '../middleware/auth';

const router = express.Router();

/**
 * Generate Cloudinary Signature
 */
router.post(
  '/cloudinary-sign',
  protect,
  generateCloudinarySignature
);

/**
 * Upload Images Route
 * Flow:
 * 1. protect (auth)
 * 2. debug before multer
 * 3. multer (upload.array)
 * 4. debug after multer
 * 5. controller
 */
router.post(
  '/images',

  // 🔐 Authentication
  protect,

  // 🐛 Debug - before multer
  (req, res, next) => {
    console.log('🚀 Upload route hit');
    console.log('➡️ Content-Type:', req.headers['content-type']);
    next();
  },

  // 📤 Multer middleware
  uploadArray,

  // 🐛 Debug - after multer
  (req, res, next) => {
    console.log('✅ After multer');
    console.log('Files received:', req.files);
    console.log('Files count:', Array.isArray(req.files) ? req.files.length : 0);
    next();
  },

  // ☁️ Cloudinary upload handler
  uploadImages
);

export default router;
