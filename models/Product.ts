import mongoose, { Document } from 'mongoose';

export interface IProduct {
  name: string;
  description: string;
  price: number;
  weight?: string;
  shelfLife?: string;
  countInStock: number;
  images: string[];
  videoUrl?: string;
  category: mongoose.Types.ObjectId;
  isActive: boolean;
}

const ProductSchema = new mongoose.Schema<IProduct & Document>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  weight: { type: String },        // ADD "250g"
  shelfLife: { type: String },     // ADD "7 days"  
  countInStock: { type: Number, required: true, default: 0 },
  images: [{ type: String, required: true }],
  videoUrl: { type: String }, // Optional field for product video URL
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  isActive: { type: Boolean, default: true }       // ADD
}, { timestamps: true });

const Product = mongoose.model<IProduct & Document>('Product', ProductSchema);
export default Product;