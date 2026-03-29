import mongoose, { Document } from 'mongoose';

export type GiveAwayConditionType =
  | 'minOrderAmount' // any single order total >= value
  | 'minOrdersInDay' // orders count in a day >= value
  | 'minLifetimeOrders' // total orders count >= value
  | 'minLifetimeSpent'; // total spent >= value

export interface IGiveAwayCondition {
  type: GiveAwayConditionType;
  value: number;
  isEnabled: boolean;
}

export type GiveAwayRewardType =
  | 'free_shipping'
  | 'flat_discount'
  | 'percentage_discount'
  | 'free_item'
  | 'other';

export interface IGiveAwayReward {
  type: GiveAwayRewardType;
  /** e.g. amount for discount, or productId/name for free_item/other */
  value?: number;
  label?: string;
  productId?: mongoose.Types.ObjectId;
}

export interface IGiveAwaySelectedProduct {
  product: mongoose.Types.ObjectId;
  /** Which variant is given (if variants exist). Default 0. */
  selectedVariantIndex?: number;
  /** Quantity to give away when user is eligible. */
  qty: number;
}

export interface IGiveAway {
  title: string;
  description?: string;
  isActive: boolean;
  startAt?: Date;
  endAt?: Date;
  conditions: IGiveAwayCondition[];
  /** Optional: admin can pre-select products, but current flow is per-order selection. */
  selectedProducts?: IGiveAwaySelectedProduct[];
  reward: IGiveAwayReward;
  createdBy?: mongoose.Types.ObjectId;
}

export interface GiveAwayDocument extends IGiveAway, Document {}

const GiveAwayConditionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['minOrderAmount', 'minOrdersInDay', 'minLifetimeOrders', 'minLifetimeSpent'],
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: 0
    },
    isEnabled: {
      type: Boolean,
      default: true
    }
  },
  { _id: false }
);

const GiveAwayRewardSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['free_shipping', 'flat_discount', 'percentage_discount', 'free_item', 'other'],
      required: true
    },
    value: {
      type: Number,
      min: 0,
      default: undefined
    },
    label: {
      type: String,
      trim: true,
      maxlength: 200,
      default: undefined
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: undefined
    }
  },
  { _id: false }
);

const GiveAwaySelectedProductSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    selectedVariantIndex: {
      type: Number,
      default: 0,
      min: 0
    },
    qty: {
      type: Number,
      required: true,
      min: 1
    }
  },
  { _id: false }
);

const GiveAwaySchema = new mongoose.Schema<GiveAwayDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    startAt: {
      type: Date,
      default: undefined,
      index: true
    },
    endAt: {
      type: Date,
      default: undefined,
      index: true
    },
    conditions: {
      type: [GiveAwayConditionSchema],
      default: []
    },
    selectedProducts: {
      type: [GiveAwaySelectedProductSchema],
      default: []
    },
    reward: {
      type: GiveAwayRewardSchema,
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: undefined
    }
  },
  { timestamps: true }
);

GiveAwaySchema.index({ isActive: 1, startAt: 1, endAt: 1 });

const GiveAway = mongoose.model<GiveAwayDocument>('GiveAway', GiveAwaySchema);
export default GiveAway;
