import mongoose, { Document, Model, PopulatedDoc, PopulateOptions, Types } from 'mongoose';
import { IProduct } from './Product';

// Cart Item Interface for User
export interface ICartItem {
  product: PopulatedDoc<IProduct & Document>;
  qty: number;
  selectedVariantIndex?: number;
}

// Enhanced Address Interface (for input/creation - without _id)
export interface IAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  locationName?: string;
  isDefault?: boolean;
}

// Address Document Interface (what's stored in DB - with _id)
export interface IAddressDocument extends IAddress, Document {
  _id: Types.ObjectId;
}

export interface IUser {
  username: string;
  email: string;
  password: string;
  phone: string;
  resetOTP?: string;
  resetOTPExpiry?: Date;
  resetOTPAttempts?: number;
  newsletterSubscribed?: boolean;
  isPhoneVerified?:boolean;
  addresses: Types.DocumentArray<IAddressDocument>; // Use Mongoose DocumentArray type
  cart: ICartItem[];
  wishlist: Array<PopulatedDoc<IProduct & Document>>;
  deliveryProfile?: {
    vehicleType?: string;
    licenseNumber?: string;
    areas?: string[];
    aadharCardImageUrl?: string;
    panCardImageUrl?: string;
    drivingLicenseImageUrl?: string;
    status?: 'pending' | 'approved' | 'rejected';
  };
  isAdmin: boolean;
  role: 'user' | 'admin' | 'delivery' | 'delivery-pending';
}

export interface UserDocument extends IUser, Document {}

export interface UserModel extends Model<UserDocument> {
  populate(path: string | string[] | PopulateOptions | (string | PopulateOptions)[]): mongoose.Query<any, UserDocument>;
}

const UserSchema = new mongoose.Schema<UserDocument, UserModel>({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  phone: { type: String, required: true, unique: true },
  resetOTP: { type: String },
  resetOTPExpiry: { type: Date },
  resetOTPAttempts: { type: Number, default: 0 },
  newsletterSubscribed: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  
  // Enhanced addresses schema with full location data
  addresses: [{
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true, default: 'India' },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    locationName: { type: String },
    isDefault: { type: Boolean, default: false }
  }],
  
  cart: [
    {
      product: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: true 
      },
      qty: { 
        type: Number, 
        required: true, 
        min: 1, 
        default: 1 
      },
      selectedVariantIndex: { 
        type: Number, 
        default: 0, 
        min: 0 
      }
    }
  ],
  wishlist: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  ],
  deliveryProfile: {
    vehicleType: { type: String },
    licenseNumber: { type: String },
    areas: [{ type: String }],
    aadharCardImageUrl: { type: String },
    panCardImageUrl: { type: String },
    drivingLicenseImageUrl: { type: String },
    status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  },
  isAdmin: { type: Boolean, default: false },
  role: { type: String, enum: ['user', 'admin', 'delivery', 'delivery-pending'], default: 'user' },
}, { timestamps: true });

const User = mongoose.model<UserDocument, UserModel>('User', UserSchema);
export default User;