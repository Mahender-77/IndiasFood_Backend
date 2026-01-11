import express from 'express';
import { generateCloudinarySignature } from '../controllers/uploadController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.post('/cloudinary-sign', protect, generateCloudinarySignature);

export default router;
