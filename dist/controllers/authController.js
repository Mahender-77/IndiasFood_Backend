"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserProfile = exports.loginUser = exports.registerUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const authValidation_1 = require("../utils/authValidation");
// Helper to generate JWT token
const generateToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};
// // Configure nodemailer transporter
// export const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST, // MUST be smtp.gmail.com
//   port: Number(process.env.SMTP_PORT), // 587
//   secure: false, // IMPORTANT for 587
//   auth: {
//     user: process.env.SMTP_EMAIL,
//     pass: process.env.SMTP_PASSWORD,
//   },
//   tls: {
//     rejectUnauthorized: false
//   },
//   // Force IPv4 to avoid IPv6 localhost connection issues
//   family: 4,
// });
const registerUser = async (req, res) => {
    const { error } = authValidation_1.registerSchema.validate(req.body);
    if (error)
        return res.status(400).json({ message: error.details[0].message });
    const { username, email, password, phone } = req.body;
    try {
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const existingUser = await User_1.default.findOne({ email });
        if (existingUser)
            return res.status(400).json({ message: 'User exists' });
        const user = new User_1.default({
            username,
            email,
            password: hashedPassword,
            phone,
        });
        await user.save();
        const token = generateToken(user._id.toString());
        res.status(201).json({
            token,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.registerUser = registerUser;
const loginUser = async (req, res) => {
    const { error } = authValidation_1.loginSchema.validate(req.body);
    if (error)
        return res.status(400).json({ message: error.details[0].message });
    const { email, password } = req.body;
    try {
        const user = await User_1.default.findOne({ email });
        if (!user || !(await bcryptjs_1.default.compare(password, user.password || ''))) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const token = generateToken(user._id.toString());
        res.json({
            token,
            user: { _id: user._id, username: user.username, email: user.email },
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.loginUser = loginUser;
const getUserProfile = async (req, res) => {
    // Assuming JWT middleware populates req.user with _id
    const userId = req.user?._id;
    if (!userId) {
        return res.status(401).json({ message: 'Not authenticated.' });
    }
    const user = await User_1.default.findById(userId).select('-password');
    if (user) {
        // Ensure isAdmin is consistent with role
        const isAdmin = user.role === 'admin' || user.isAdmin;
        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            isAdmin,
            addresses: user.addresses,
            role: user.role,
            deliveryProfile: user.deliveryProfile, // Include delivery profile if it exists
        });
    }
    else {
        res.status(404).json({ message: 'User not found' });
    }
};
exports.getUserProfile = getUserProfile;
// export const forgotPassword = async (req: Request, res: Response) => {
//   try {
//     const { email } = req.body;
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     user.resetOTP = otp;
//     user.resetOTPExpiry = new Date(Date.now() + 10 * 60 * 1000);
//     user.resetOTPAttempts = 0;
//     await user.save();
//     // Try to send email, but don't fail if email service is not configured
//     console.log('SMTP CHECK:', {
//       host: process.env.SMTP_HOST,
//       port: process.env.SMTP_PORT,
//       email: process.env.SMTP_EMAIL,
//     });
//     try {
//       await transporter.sendMail({
//         from: `"India's Food" <${process.env.SMTP_EMAIL}>`,
//         to: email,
//         subject: 'Password Reset OTP',
//         html: `<h2>Your OTP: ${otp}</h2><p>Valid for 10 minutes</p>`,
//       });
//       console.log(`OTP sent to ${email}: ${otp}`);
//     } catch (emailError) {
//       // Log OTP to console for development if email fails
//       console.log('Email service not configured. OTP for development:', otp);
//       console.error('Email error:', emailError);
//     }
//     res.json({ message: 'OTP sent successfully' });
//   } catch (err: any) {
//     console.error('Forgot password error:', err);
//     res.status(500).json({ message: err.message || 'Failed to send OTP' });
//   }
// };
// export const verifyOTP = async (req: Request, res: Response) => {
//   try {
//     const { email, otp } = req.body;
//     const user = await User.findOne({ email });
//     if (!user || !user.resetOTP || !user.resetOTPExpiry) {
//       return res.status(400).json({ message: 'Invalid request' });
//     }
//     // ⛔ Expired OTP
//     if (user.resetOTPExpiry < new Date()) {
//       return res.status(400).json({ message: 'OTP expired' });
//     }
//     // 🔒 Too many attempts
//     if ((user.resetOTPAttempts ?? 0) >= 5) {
//       return res.status(429).json({
//         message: 'Too many invalid attempts. Please resend OTP.',
//       });
//     }
//     // ❌ Wrong OTP
//     if (user.resetOTP !== otp) {
//       user.resetOTPAttempts = (user.resetOTPAttempts ?? 0) + 1;
//       await user.save();
//       return res.status(400).json({ message: 'Invalid OTP' });
//     }
//     // ✅ OTP verified
//     res.json({ message: 'OTP verified' });
//   } catch (err) {
//     res.status(500).json({ message: 'Failed to verify OTP' });
//   }
// };
// export const resetPassword = async (req: Request, res: Response) => {
//   try {
//     const { email, otp, password } = req.body;
//     const user = await User.findOne({ email });
//     if (
//       !user ||
//       user.resetOTP !== otp ||
//       !user.resetOTPExpiry ||
//       user.resetOTPExpiry < new Date()
//     ) {
//       return res.status(400).json({ message: 'Invalid or expired OTP' });
//     }
//     user.password = await bcrypt.hash(password, 10);
//     // 🧹 Clear OTP data
//     user.resetOTP = undefined;
//     user.resetOTPExpiry = undefined;
//     user.resetOTPAttempts = undefined;
//     await user.save();
//     res.json({ message: 'Password reset successful' });
//   } catch (err) {
//     res.status(500).json({ message: 'Failed to reset password' });
//   }
// };
