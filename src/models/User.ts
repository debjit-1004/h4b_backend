import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  name?: string;
  email: string;
  password?: string; // Made password optional for Civic Auth
  lastLogout?: Date;
  score: number;
  location: {
    type: 'Point';
    coordinates: number[]; // [longitude, latitude]
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  name: { type: String },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: false }, // Changed to false
  lastLogout: { type: Date },
  score: { type: Number, default: 0 },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  }
}, { timestamps: true });

export default model<IUser>('User', userSchema);
