import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  name?: string;
  email: string;
  password: string;
  lastLogout?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  name: { type: String },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  lastLogout: { type: Date }
}, { timestamps: true });

export default model<IUser>('User', userSchema);
