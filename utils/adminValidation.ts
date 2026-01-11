import Joi from 'joi';

export const createProductSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  price: Joi.number().min(0).required(),
  weight: Joi.string().optional(),
  shelfLife: Joi.string().optional(),
  category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(), // Validate as ObjectId
  countInStock: Joi.number().min(0).required(),
  videoUrl: Joi.string().uri().optional(), // Optional video URL, validated as a URI
  isActive: Joi.boolean().optional(),
});

export const updateProductSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  price: Joi.number().min(0).optional(),
  weight: Joi.string().optional(),
  shelfLife: Joi.string().optional(),
  category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  countInStock: Joi.number().min(0).optional(),
  videoUrl: Joi.string().uri().optional(),
  images: Joi.array().items(Joi.string().uri()).optional(), // For updating images (e.g., removing old ones)
  isActive: Joi.boolean().optional(),
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid('placed', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled').required(),
});

export const updateOrderDeliverySchema = Joi.object({
  isDelivered: Joi.boolean().required(),
});

export const assignDeliveryPersonSchema = Joi.object({
  deliveryPersonId: Joi.string().required(),
  eta: Joi.string().required(),
});

export const createCategorySchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  isActive: Joi.boolean().optional(),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().min(3).max(50).optional(),
  isActive: Joi.boolean().optional(),
});
