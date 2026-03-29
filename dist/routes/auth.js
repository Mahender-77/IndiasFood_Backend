"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/register', authController_1.registerUser);
router.post('/login', authController_1.loginUser);
router.get('/profile', auth_1.protect, authController_1.getUserProfile);
// router.post('/forgot-password', forgotPassword);
// router.post('/verify-otp', verifyOTP);
// router.post('/reset-password', resetPassword);
//SMS
router.route('/send-otp').post(authController_1.sendPhoneOtp);
router.route('/verify-otp').post(authController_1.verifyPhoneOtp);
// Login with OTP (passwordless login)
router.post('/login-with-otp', authController_1.loginWithOtp);
// Reset password (after OTP verification)
router.post('/reset-password', authController_1.resetPassword);
exports.default = router;
