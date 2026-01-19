import Joi from 'joi';

export const createProductSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  originalPrice: Joi.number().min(0).required(),
  offerPrice: Joi.number().min(0).optional(),
  variants: Joi.array().items(Joi.object({
    type: Joi.string().valid('weight', 'pieces', 'box').required(),
    value: Joi.string().required(),
    originalPrice: Joi.number().min(0).required(),
    offerPrice: Joi.number().min(0).optional(),
  })).optional(),
  shelfLife: Joi.string().optional(),
  category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  inventory: Joi.array().items(Joi.object({
    location: Joi.string().valid('hyderabad', 'vizag', 'vijayawada', 'bangalore').required(),
    stock: Joi.array().items(Joi.object({
      variantIndex: Joi.number().min(0).required(),
      quantity: Joi.number().min(0).required(),
      lowStockThreshold: Joi.number().min(0).optional(),
    })).required(),
  })).optional(),
  videoUrl: Joi.string().uri().allow('').optional(),
  images: Joi.array().items(Joi.string().uri()).optional(),
  isActive: Joi.boolean().optional(),
  isGITagged: Joi.boolean().optional(),
  isNewArrival: Joi.boolean().optional(),
});

export const updateProductSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  originalPrice: Joi.number().min(0).optional(),
  offerPrice: Joi.number().min(0).optional(),
  variants: Joi.array().items(Joi.object({
    type: Joi.string().valid('weight', 'pieces', 'box').required(),
    value: Joi.string().required(),
    originalPrice: Joi.number().min(0).required(),
    offerPrice: Joi.number().min(0).optional(),
  })).optional(),
  shelfLife: Joi.string().optional(),
  category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  inventory: Joi.array().items(Joi.object({
    location: Joi.string().valid('hyderabad', 'vizag', 'vijayawada', 'bangalore').required(),
    stock: Joi.array().items(Joi.object({
      variantIndex: Joi.number().min(0).required(),
      quantity: Joi.number().min(0).required(),
      lowStockThreshold: Joi.number().min(0).optional(),
    })).required(),
  })).optional(),
  videoUrl: Joi.string().uri().optional(),
  images: Joi.array().items(Joi.string().uri()).optional(),
  isActive: Joi.boolean().optional(),
  isGITagged: Joi.boolean().optional(),
  isNewArrival: Joi.boolean().optional(),
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
