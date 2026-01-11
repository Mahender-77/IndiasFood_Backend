"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const storage = multer_1.default.memoryStorage(); // Use memoryStorage to avoid saving files locally
const checkFileType = (file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path_1.default.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
        return cb(null, true);
    }
    else {
        cb(new Error('Images Only!'));
    }
};
const upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: (req, file, cb) => {
        checkFileType(file, cb);
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});
exports.default = upload;
