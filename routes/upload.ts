import express from 'express';
import { uploadArray, uploadImages } from '../controllers/uploadController';
import { protect } from '../middleware/auth';

const router = express.Router();

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
router.post(
  '/images',

  // 🔐 Authentication
  protect,

 
  // 📤 Multer middleware
  uploadArray,


  // ☁️ BunnyCDN upload handler
  uploadImages
);

export default router;
