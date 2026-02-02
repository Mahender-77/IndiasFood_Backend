import express, { Request, Response } from 'express';
import { protect } from '../middleware/auth';
import { handleUengageWebhook } from '../controllers/uEngage';
const router = express.Router();

router.route('/callback').post(handleUengageWebhook)

export default router;