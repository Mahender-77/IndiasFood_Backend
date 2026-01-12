"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryApplicationSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.deliveryApplicationSchema = joi_1.default.object({
    vehicleType: joi_1.default.string().required(),
    licenseNumber: joi_1.default.string().required(),
    areas: joi_1.default.array().items(joi_1.default.string()).required(),
    aadharCardImageUrl: joi_1.default.string().required(),
    panCardImageUrl: joi_1.default.string().required(),
    drivingLicenseImageUrl: joi_1.default.string().required(),
});
