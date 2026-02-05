"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImages = exports.uploadArray = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
/* ===============================
   MULTER CONFIG
================================ */
const storage = multer_1.default.memoryStorage();
const checkFileType = (file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path_1.default.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype)
        cb(null, true);
    else
        cb(new Error('Only image files are allowed'));
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter: (req, file, cb) => checkFileType(file, cb),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});
exports.uploadArray = upload.array('images', 10);
/* ===============================
   BUNNY CONFIG
================================ */
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_REGION = process.env.BUNNY_REGION;
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
/* ===============================
   UPLOAD CONTROLLER
================================ */
const uploadImages = async (req, res) => {
    try {
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            return res.status(400).json({ message: 'No images uploaded' });
        }
        const files = req.files;
        const uploadPromises = files.map(async (file) => {
            const ext = path_1.default.extname(file.originalname);
            const fileName = `products/${crypto_1.default.randomUUID()}${ext}`;
            const uploadUrl = `https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/${fileName}`;
            await axios_1.default.put(uploadUrl, file.buffer, {
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
    }
    catch (error) {
        console.error("❌ Bunny upload failed");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
            console.error("Headers:", error.response.headers);
        }
        else {
            console.error("Message:", error.message);
        }
        res.status(500).json({
            message: "Failed to upload images",
            bunnyError: error.response?.data || error.message
        });
    }
};
exports.uploadImages = uploadImages;
