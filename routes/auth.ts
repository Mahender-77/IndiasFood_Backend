import express from 'express';
import { registerUser, loginUser, getUserProfile } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
// router.post('/forgot-password', forgotPassword);
// router.post('/verify-otp', verifyOTP);
// router.post('/reset-password', resetPassword);

export default router;