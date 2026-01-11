import express from 'express';
import authRoutes from './auth';
import productRoutes from './products';
import userRoutes from './user';
import adminRoutes from './admin';
import deliveryRoutes from './delivery';
import uploadRoutes from './upload';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/user', userRoutes);
router.use('/admin', adminRoutes);
router.use('/delivery', deliveryRoutes);
router.use('/upload', uploadRoutes);

export default router;
