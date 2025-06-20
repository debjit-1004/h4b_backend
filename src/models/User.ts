import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  name?: string;
  email: string;
  googleId?: string; // Added for Google OAuth
  password?: string;
  lastLogout?: Date;
  score: number;
  profilePicture?: string; // Added for Google profile picture
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
  googleId: { type: String, unique: true, sparse: true }, // Added for Google OAuth
  password: { type: String, required: false },
  profilePicture: { type: String }, // URL to profile picture
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
