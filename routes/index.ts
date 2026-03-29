import express from 'express';
import adminRoutes from './admin';
import authRoutes from './auth';
import bulkOrderRoutes from './bulkOrder';
import deliveryRoutes from './delivery';
import productRoutes from './products';
import uEngage from './uEngage';
import uploadRoutes from './upload';
import userRoutes from './user';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/bulk-orders', bulkOrderRoutes);
router.use('/products', productRoutes);
router.use('/user', userRoutes);
router.use('/admin', adminRoutes);
router.use('/delivery', deliveryRoutes);
router.use('/upload', uploadRoutes);
router.use('/uEngage',uEngage)


export default router;
