import Joi from 'joi';

const batchSchema = Joi.object({
  batchNumber: Joi.string().required(),
  quantity: Joi.number().min(0).required(),
  manufacturingDate: Joi.date().required(),
  expiryDate: Joi.date().required(),
  purchasePrice: Joi.number().min(0).required(),
  sellingPrice: Joi.number().min(0).required(),
  variantIndex: Joi.number().min(0).required(),
});

const stockSchema = Joi.object({
  variantIndex: Joi.number().min(0).required(),
  quantity: Joi.number().min(0).required(),
  lowStockThreshold: Joi.number().min(0).optional(),
});

const inventoryItemSchema = Joi.object({
  location: Joi.string().required(),
  batches: Joi.array().items(batchSchema).optional(),
  stock: Joi.array().items(stockSchema).optional(),
}).or('batches', 'stock');

/** Step 1: Basic product creation only - no store, no price, no deal */
export const createProductBasicSchema = Joi.object({
  name: Joi.string().required().max(100),
  description: Joi.string().optional().max(1000),
  category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  subcategory: Joi.string().optional().max(100),
  videoUrl: Joi.string().uri().allow('').optional(),
  images: Joi.array().items(Joi.string().uri()).optional(),
  originLocation: Joi.string().optional().max(100),
  isGITagged: Joi.boolean().optional(),
  isNewArrival: Joi.boolean().optional(),
  isMostSaled: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
}).options({ stripUnknown: true });

/** Add batches payload - Step 2/3: store, pricing, variants, batches (each batch has its own deal) */
const batchInputSchema = Joi.object({
  location: Joi.string().required().lowercase(),
  batchNumber: Joi.string().required(),
  manufacturingDate: Joi.date().required(),
  expiryDate: Joi.date().required().greater(Joi.ref('manufacturingDate')),
  purchasePrice: Joi.number().min(0).required(),
  sellingPrice: Joi.number().min(0).required(),
  variantIndex: Joi.number().min(0).optional(),
  quantity: Joi.number().min(0).required(),
  batchWholePrice: Joi.number().min(0).optional(),
  dealTriggerDays: Joi.number().min(0).optional(),
  dealDiscountPercent: Joi.number().min(0).max(100).optional(),
  newArrivalUntil: Joi.date().optional().allow(null),
});

export const addBatchesSchema = Joi.object({
  store: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  originalPrice: Joi.number().min(0).optional(),
  offerPrice: Joi.number().min(0).optional(),
  addVariants: Joi.array().items(Joi.object({
    type: Joi.string().valid('weight', 'pieces', 'box').required(),
    value: Joi.string().required(),
    originalPrice: Joi.number().min(0).required(),
    offerPrice: Joi.number().min(0).optional(),
  })).optional(),
  batches: Joi.array().items(batchInputSchema).min(1).required(),
});

export const createProductSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  originalPrice: Joi.number().min(0).optional(),
  offerPrice: Joi.number().min(0).optional(),
  variants: Joi.array().items(Joi.object({
    type: Joi.string().valid('weight', 'pieces', 'box').required(),
    value: Joi.string().required(),
    originalPrice: Joi.number().min(0).required(),
    offerPrice: Joi.number().min(0).optional(),
  })).optional(),
  category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  store: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  inventory: Joi.array().items(inventoryItemSchema).optional(),
  videoUrl: Joi.string().uri().allow('').optional(),
  images: Joi.array().items(Joi.string().uri()).optional(),
  isActive: Joi.boolean().optional(),
  isGITagged: Joi.boolean().optional(),
  isNewArrival: Joi.boolean().optional(),
  dealTriggerDays: Joi.number().min(0).optional(),
  dealDiscountPercent: Joi.number().min(0).max(100).optional(),
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
  category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  inventory: Joi.array().items(inventoryItemSchema).optional(),
  videoUrl: Joi.string().uri().optional(),
  images: Joi.array().items(Joi.string().uri()).optional(),
  isActive: Joi.boolean().optional(),
  isGITagged: Joi.boolean().optional(),
  isNewArrival: Joi.boolean().optional(),
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid('placed', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled').required(),
  cancelReason: Joi.string().when('status', {
    is: 'cancelled',
    then: Joi.string().min(1).max(500).required(),
    otherwise: Joi.string().optional()
  }),
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
  subcategories: Joi.array().items(Joi.object({
    name: Joi.string().min(1).max(50).required(),
    isActive: Joi.boolean().optional(),
  })).optional(),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().min(3).max(50).optional(),
  isActive: Joi.boolean().optional(),
  subcategories: Joi.array().items(Joi.object({
    name: Joi.string().min(1).max(50).required(),
    isActive: Joi.boolean().optional(),
  })).optional(),
});
