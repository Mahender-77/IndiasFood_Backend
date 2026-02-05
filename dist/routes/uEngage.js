"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const uEngage_1 = require("../controllers/uEngage");
const router = express_1.default.Router();
router.route('/callback').post(uEngage_1.handleUengageWebhook);
exports.default = router;
