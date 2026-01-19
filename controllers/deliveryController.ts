import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User, { UserDocument, UserModel as IUserModel } from '../models/User'; // Import UserDocument and UserModel
import { deliveryApplicationSchema } from '../utils/deliveryValidation';

// @desc    Apply to become a delivery partner
// @route   POST /api/delivery/apply
// @access  Private
export const applyForDelivery = async (req: Request, res: Response) => {
  const { error } = deliveryApplicationSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { vehicleType, licenseNumber, areas, aadharCardImageUrl, panCardImageUrl, drivingLicenseImageUrl } = req.body;

  try {
    const user = await User.findOne({ _id: req.user?._id });

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
    user.role = 'delivery-pending'; // Set role to delivery-pending
    await user.save();

    res.status(200).json({ message: 'Delivery application submitted successfully.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    console.log(error);
  }
};

// @desc    Get all pending delivery applications
// @route   GET /api/delivery/applications
// @access  Private/Admin
export const getPendingApplications = async (req: Request, res: Response) => {
  try {
    // Only show users with role 'delivery-pending' who have delivery profiles
    const applications = await (User as any).find({
      role: 'delivery-pending',
      deliveryProfile: { $exists: true }
    })
      .select('-password')
      .populate('addresses') // Populate addresses for full user details
      .populate('cart.product') // Populate product details in cart
      .populate('wishlist'); // Populate wishlist products
    res.json(applications);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve a delivery application
// @route   PUT /api/delivery/:id/approve
// @access  Private/Admin
export const approveDeliveryApplication = async (req: Request, res: Response) => {
  try {
    const user = await User.findOne({ _id: req.params.id });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.deliveryProfile || user.deliveryProfile.status !== 'pending' || user.role !== 'delivery-pending') {
      return res.status(400).json({ message: 'No pending delivery application for this user' });
    }

    user.deliveryProfile.status = 'approved';
    user.role = 'delivery'; // Change user role from delivery-pending to delivery
    await user.save();

    res.status(200).json({ message: 'Delivery application approved and user role updated.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
