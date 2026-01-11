import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { UserDocument } from '../models/User';
import { registerSchema, loginSchema } from '../utils/authValidation';

// Helper to generate JWT token
const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: '30d',
  });
};

export const registerUser = async (req: Request, res: Response) => {
  const { error } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { username, email, password, addresses } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User exists' });

    user = new User({
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  const { error } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password || ''))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id.toString());
    res.json({
      token,
      user: { _id: user._id, username: user.username, email: user.email },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  // Assuming JWT middleware populates req.user with _id
  const userId = req.user?._id;

  if (!userId) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }

  const user = await User.findById(userId).select('-password');

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
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};