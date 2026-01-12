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
const registerUser = async (req, res) => {
    const { error } = authValidation_1.registerSchema.validate(req.body);
    if (error)
        return res.status(400).json({ message: error.details[0].message });
    const { username, email, password, addresses } = req.body;
    try {
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        let user = await User_1.default.findOne({ email });
        if (user)
            return res.status(400).json({ message: 'User exists' });
        user = new User_1.default({
            username,
            email,
            password: hashedPassword,
            addresses: addresses || [],
        });
        await user.save();
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
        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin,
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
