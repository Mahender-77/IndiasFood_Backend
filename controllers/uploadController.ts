import { Request, Response } from 'express';
import cloudinary from '../config/cloudinary';

export const generateCloudinarySignature = async (req: Request, res: Response) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp: timestamp, folder: 'indias-food' },
      process.env.CLOUDINARY_API_SECRET as string
    );

    res.status(200).json({
      signature,
      timestamp,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
