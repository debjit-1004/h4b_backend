import { Schema, model, Document, Types } from 'mongoose';

export interface ISpace extends Document {
  title: string;
  description: string;
  creatorId: Types.ObjectId;
  timestamp: number;
  eventDate?: number;
  subscribers: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const spaceSchema = new Schema<ISpace>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  timestamp: { type: Number, required: true },
  eventDate: { type: Number },
  subscribers: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
}, { timestamps: true });

export default model<ISpace>('Space', spaceSchema);
