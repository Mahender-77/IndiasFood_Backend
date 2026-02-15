import mongoose, { Document } from 'mongoose';

export interface IStoreLocation {
  _id?: mongoose.Types.ObjectId;
  storeId?: mongoose.Types.ObjectId;  // Auto-generated, optional in interface
  name: string;
  contact_number: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface IDeliverySettings {
  pricePerKm: number;
  baseCharge: number;
  freeDeliveryThreshold: number;
  gstPercentage: number; 
  storeLocations: IStoreLocation[];
}

export interface DeliverySettingsDocument extends IDeliverySettings, Document {}

const StoreLocationSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),  // 🔥 AUTO-GENERATE
    index: true
  },
  name: {
    type: String,
    required: [true, 'Store name is required'],
    trim: true
  },
  contact_number: {
    type: String,
    required: [true, 'Contact number is required'],
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Store address is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  latitude: {
    type: Number,
    required: [true, 'Latitude is required'],
    min: [-90, 'Latitude must be between -90 and 90'],
    max: [90, 'Latitude must be between -90 and 90']
  },
  longitude: {
    type: Number,
    required: [true, 'Longitude is required'],
    min: [-180, 'Longitude must be between -180 and 180'],
    max: [180, 'Longitude must be between -180 and 180']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const DeliverySettingsSchema = new mongoose.Schema<DeliverySettingsDocument>({
  pricePerKm: {
    type: Number,
    required: true,
    default: 10,
    min: 0
  },
  gstPercentage: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 100
  },
  
  baseCharge: {
    type: Number,
    required: true,
    default: 50,
    min: 0
  },
  freeDeliveryThreshold: {
    type: Number,
    required: true,
    default: 500,
    min: 0
  },
  storeLocations: {
    type: [StoreLocationSchema],
    default: [],
    validate: {
      validator: function(v: IStoreLocation[]) {
        // At least one active store required
        return v.length > 0 && v.some(store => store.isActive);
      },
      message: 'At least one active store location is required'
    }
  }
}, { timestamps: true });

const DeliverySettings = mongoose.model<DeliverySettingsDocument>(
  'DeliverySettings', 
  DeliverySettingsSchema
);

export default DeliverySettings;