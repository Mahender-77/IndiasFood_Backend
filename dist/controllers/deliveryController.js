"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveDeliveryApplication = exports.getPendingApplications = exports.applyForDelivery = void 0;
const User_1 = __importDefault(require("../models/User")); // Import UserDocument and UserModel
const deliveryValidation_1 = require("../utils/deliveryValidation");
// @desc    Apply to become a delivery partner
// @route   POST /api/delivery/apply
// @access  Private
const applyForDelivery = async (req, res) => {
    const { error } = deliveryValidation_1.deliveryApplicationSchema.validate(req.body);
    if (error)
        return res.status(400).json({ message: error.details[0].message });
    const { vehicleType, licenseNumber, areas, aadharCardImageUrl, panCardImageUrl, drivingLicenseImageUrl } = req.body;
    try {
        const user = await User_1.default.findOne({ _id: req.user?._id });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.role === 'delivery') {
            return res.status(400).json({ message: 'User is already a delivery partner' });
        }
        user.deliveryProfile = {
            vehicleType,
            licenseNumber,
            areas,
            aadharCardImageUrl,
            panCardImageUrl,
            drivingLicenseImageUrl,
            status: 'pending', // Automatically set to pending
        };
        await user.save();
        res.status(200).json({ message: 'Delivery application submitted successfully.' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.applyForDelivery = applyForDelivery;
// @desc    Get all pending delivery applications
// @route   GET /api/delivery/applications
// @access  Private/Admin
const getPendingApplications = async (req, res) => {
    try {
        const applications = await User_1.default.find({ 'deliveryProfile.status': 'pending' })
            .select('-password')
            .populate('addresses') // Populate addresses for full user details
            .populate('cart.product') // Populate product details in cart
            .populate('wishlist'); // Populate wishlist products
        res.json(applications);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getPendingApplications = getPendingApplications;
// @desc    Approve a delivery application
// @route   PUT /api/delivery/:id/approve
// @access  Private/Admin
const approveDeliveryApplication = async (req, res) => {
    try {
        const user = await User_1.default.findOne({ _id: req.params.id });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (!user.deliveryProfile || user.deliveryProfile.status !== 'pending') {
            return res.status(400).json({ message: 'No pending delivery application for this user' });
        }
        user.deliveryProfile.status = 'approved';
        user.role = 'delivery'; // Change user role to delivery
        await user.save();
        res.status(200).json({ message: 'Delivery application approved and user role updated.' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.approveDeliveryApplication = approveDeliveryApplication;
