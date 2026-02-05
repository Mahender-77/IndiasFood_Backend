import axios from 'axios';
import crypto from 'crypto';
import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';

/* ===============================
   MULTER CONFIG
================================ */
const storage = multer.memoryStorage();

const checkFileType = (file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const filetypes = /jpeg|jpg|png|gif|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => checkFileType(file, cb),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

export const uploadArray = upload.array('images', 10);

/* ===============================
   BUNNY CONFIG
================================ */
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE!;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY!;
const BUNNY_REGION = process.env.BUNNY_REGION!;
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL!;



/* ===============================
   UPLOAD CONTROLLER
================================ */
export const uploadImages = async (req: Request, res: Response) => {
  
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded' });
    }

    const files = req.files as Express.Multer.File[];

    const uploadPromises = files.map(async (file) => {
      const ext = path.extname(file.originalname);
      const fileName = `products/${crypto.randomUUID()}${ext}`;

      const uploadUrl = `https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/${fileName}`;


      await axios.put(uploadUrl, file.buffer, {
        headers: {
          AccessKey: BUNNY_API_KEY,
          'Content-Type': file.mimetype
        },
        maxBodyLength: Infinity
      });

      return `${BUNNY_CDN_URL}/${fileName}`;
    });

    const urls = await Promise.all(uploadPromises);

    res.status(200).json({
      message: 'Images uploaded successfully',
      urls
    });

  } catch (error: any) {
    console.error("❌ Bunny upload failed");
  
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
      console.error("Headers:", error.response.headers);
    } else {
      console.error("Message:", error.message);
    }
  
    res.status(500).json({
      message: "Failed to upload images",
      bunnyError: error.response?.data || error.message
    });
  }
  
}
