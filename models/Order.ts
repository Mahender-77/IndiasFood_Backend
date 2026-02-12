import mongoose, { Document } from 'mongoose';

/* ---------------- ORDER ITEM ---------------- */

export interface IOrderItem {
  name: string;
  qty: number;
  image: string;
  price: number;
  product: mongoose.Schema.Types.ObjectId;
  selectedVariantIndex?: number;
}

/* ---------------- SHIPPING ADDRESS ---------------- */

export interface IShippingAddress {
  fullName?: string;
  phone?: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

/* ---------------- ORDER INTERFACE ---------------- */

export interface IOrder {
  user: mongoose.Schema.Types.ObjectId;
  orderItems: IOrderItem[];
  shippingAddress: IShippingAddress;
  paymentMethod: string;

  paymentResult?: {
    id: string;
    status: string;
    update_time: string;
    email_address: string;
  };

  taxPrice: number;
  shippingPrice: number;
  totalPrice: number;

  distance?: number;
  nearestStore?: string;

  /* ✅ U-ENGAGE METADATA */
  uengage?: {
    taskId?: string;
    vendorOrderId?: string;
    statusCode?: string;
    message?: string;
  };

  isPaid: boolean;
  paidAt?: Date;

  isDelivered: boolean;
  deliveredAt?: Date;

  deliveryPerson?: mongoose.Schema.Types.ObjectId;
  eta?: string;

  status: 'placed' | 'confirmed' | 'out_for_delivery' | 'delivered' | 'cancelled';
  deliveryMode: 'delivery' | 'pickup';

  cancelReason?: string;
  cancelledAt?: Date;
}

export interface OrderDocument extends IOrder, Document {}

/* ---------------- ORDER SCHEMA ---------------- */

const OrderSchema = new mongoose.Schema<OrderDocument>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },

    orderItems: [
      {
        name: { type: String, required: true },
        qty: { type: Number, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true },
        product: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: 'Product',
        },
        selectedVariantIndex: { type: Number, default: 0 },
      },
    ],

    shippingAddress: {
      fullName: { type: String },
      phone: { type: String },
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      latitude: { type: Number },
      longitude: { type: Number },
    },

    paymentMethod: {
      type: String,
      required: true,
    },

    paymentResult: {
      id: { type: String },
      status: { type: String },
      update_time: { type: String },
      email_address: { type: String },
    },

    taxPrice: {
      type: Number,
      required: true,
      default: 0,
    },

    shippingPrice: {
      type: Number,
      required: true,
      default: 0,
    },

    totalPrice: {
      type: Number,
      required: true,
      default: 0,
    },

    distance: {
      type: Number,
      default: 0,
    },

    nearestStore: {
      type: String,
      default: '',
    },

    /* ✅ U-ENGAGE FIELD ADDED TO SCHEMA */
    uengage: {
      taskId: { type: String },
      vendorOrderId: { type: String },
      statusCode: { type: String },
      message: { type: String },
    },

    isPaid: {
      type: Boolean,
      required: true,
      default: false,
    },

    paidAt: {
      type: Date,
    },

    isDelivered: {
      type: Boolean,
      required: true,
      default: false,
    },

    deliveredAt: {
      type: Date,
    },

    deliveryPerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    eta: {
      type: String,
    },

    status: {
      type: String,
      enum: ['placed', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'placed',
    },

    deliveryMode: {
      type: String,
      enum: ['delivery', 'pickup'],
      default: 'delivery',
    },

    cancelReason: {
      type: String,
    },

    cancelledAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

/* ---------------- MODEL ---------------- */

const Order = mongoose.model<OrderDocument>('Order', OrderSchema);
export default Order;
