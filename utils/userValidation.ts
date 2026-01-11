import Joi from 'joi';

export const cartUpdateSchema = Joi.object({
  productId: Joi.string().required(),
  qty: Joi.number().min(0).required(),
});

export const wishlistToggleSchema = Joi.object({
  productId: Joi.string().required(),
});

export const createOrderSchema = Joi.object({
  orderItems: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    qty: Joi.number().min(1).required(),
    image: Joi.string().required(),
    price: Joi.number().required(),
    product: Joi.string().required(),
  })).min(1).required(),
  shippingAddress: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    postalCode: Joi.string().required(),
    country: Joi.string().required(),
  }).required(),
  paymentMethod: Joi.string().required(),
  taxPrice: Joi.number().required(),
  shippingPrice: Joi.number().required(),
  totalPrice: Joi.number().required(),
});
