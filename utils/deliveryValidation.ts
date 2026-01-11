import Joi from 'joi';

export const deliveryApplicationSchema = Joi.object({
  vehicleType: Joi.string().required(),
  licenseNumber: Joi.string().required(),
  areas: Joi.array().items(Joi.string()).required(),
  aadharCardImageUrl: Joi.string().required(),
  panCardImageUrl: Joi.string().required(),
  drivingLicenseImageUrl: Joi.string().required(),
});
