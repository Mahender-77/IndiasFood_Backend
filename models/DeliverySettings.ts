import mongoose, { Document } from 'mongoose';

export interface IStoreLocation {
  name: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface IDeliverySettings {
  pricePerKm: number;
  baseCharge: number;
  freeDeliveryThreshold: number;
  storeLocations: IStoreLocation[];
}

export interface DeliverySettingsDocument extends IDeliverySettings, Document {}

const StoreLocationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
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
    default: []
  }
  
}, { timestamps: true });

const DeliverySettings = mongoose.model<DeliverySettingsDocument>(
  'DeliverySettings', 
  DeliverySettingsSchema
);

export default DeliverySettings;
