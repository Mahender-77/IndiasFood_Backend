import mongoose, { Document, Model, PopulatedDoc, PopulateOptions } from 'mongoose';
import { IProduct } from './Product'; // Import IProduct

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
  cart: Array<{
    product: PopulatedDoc<IProduct & Document>;
    qty: number;
  }>;
  wishlist: Array<PopulatedDoc<IProduct & Document>>; // Use IProduct for wishlist
  deliveryProfile?: { // Optional as not all users are delivery partners
    vehicleType?: string;
    licenseNumber?: string;
    areas?: string[];
    aadharCardImageUrl?: string;
    panCardImageUrl?: string;
    drivingLicenseImageUrl?: string;
    status?: 'pending' | 'approved' | 'rejected';
  };
  isAdmin: boolean;
  role: 'user' | 'admin' | 'delivery';
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
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      qty: { type: Number, required: true, default: 1 },
    },
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
  role: { type: String, enum: ['user', 'admin', 'delivery'], default: 'user' },
}, { timestamps: true });

const User = mongoose.model<UserDocument, UserModel>('User', UserSchema);
export default User;