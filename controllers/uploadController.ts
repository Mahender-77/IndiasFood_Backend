import { NextFunction, Request, Response } from 'express';
import cloudinary from '../config/cloudinary';
import multer from 'multer';
import path from 'path';
import jwt from 'jsonwebtoken';
import User from '../models/User';

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

// Configure multer for memory storage (upload to Cloudinary manually)
const storage = multer.memoryStorage();

const checkFileType = (file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const filetypes = /jpeg|jpg|png|gif|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Create multer middleware for arrays
export const uploadArray = upload.array('images', 10);

// Authentication middleware for upload
const authenticateUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      (req as any).user = user;
      next(); // ✅ MUST CALL NEXT
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ message: 'No token provided' });
  }
};


export const uploadImages = async (req: Request, res: Response) => {
  try {
    console.log('Upload request received');
    console.log('req.files:', req.files);
    console.log('req.files type:', typeof req.files);
    console.log('req.files isArray:', Array.isArray(req.files));

    // Check if files exist - multer.array() puts files directly in req.files as an array
    if (!req.files) {
      return res.status(400).json({ message: 'No files uploaded - req.files is undefined' });
    }

    // When using multer.array('images', 10), req.files is a direct array
    let files: Express.Multer.File[];

    if (Array.isArray(req.files)) {
      // multer.array() - req.files is directly an array
      files = req.files;
    } else {
      // multer.fields() - req.files is an object with field names as keys
      files = (req.files as { [fieldname: string]: Express.Multer.File[] })['images'] || [];
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ 
        message: 'No image files uploaded',
        debug: {
          reqFilesType: typeof req.files,
          isArray: Array.isArray(req.files),
          reqFilesKeys: req.files ? Object.keys(req.files) : []
        }
      });
    }

    console.log(`Processing ${files.length} files`);

    const uploadPromises = files.map(async (file) => {
      return new Promise<string>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'indias-food',
            resource_type: 'image',
            transformation: [
              { width: 1000, height: 1000, crop: 'limit' },
              { quality: 'auto' }
            ]
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else if (result) {
              resolve(result.secure_url);
            } else {
              reject(new Error('Upload failed'));
            }
          }
        );

        stream.end(file.buffer);
      });
    });

    console.log('Starting Cloudinary uploads...');
    const urls = await Promise.all(uploadPromises);
    console.log('Cloudinary upload successful, URLs:', urls);

    res.status(200).json({
      message: 'Images uploaded successfully',
      urls: urls
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Failed to upload images', error: error.message });
  }
};

// Export multer middleware for use in routes
export { upload };
