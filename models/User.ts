import mongoose, { Document, Model, PopulatedDoc, PopulateOptions } from 'mongoose';
import { IProduct } from './Product';

// Cart Item Interface for User
export interface ICartItem {
  product: PopulatedDoc<IProduct & Document>;
  qty: number;
  selectedVariantIndex?: number; // Made optional with default 0
}

export interface IUser {
  username: string;
  email: string;
  password: string;
  addresses: Array<{
    address: string;
    city: string;
    postalCode: string;
    country: string;
  }>;
  cart: ICartItem[]; // Use the dedicated interface
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
  password: { type: String, required: true },
  addresses: [{
    address: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
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