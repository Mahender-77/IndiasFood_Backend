import mongoose, { Document, Schema } from 'mongoose';

export interface IOtp extends Document {
  phone: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index - MongoDB will automatically delete expired documents
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
otpSchema.index({ phone: 1, otp: 1 });

const Otp = mongoose.model<IOtp>('Otp', otpSchema);

export default Otp;