import { Schema, model, Document, Types } from 'mongoose';

export interface IComment {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  text: string;
  timestamp: number;
}

export interface ILocation {
  latitude: number;
  longitude: number;
  name?: string;
}

export interface IMediaItem extends Document {
  userId: Types.ObjectId;
  uri: string;
  type: 'photo' | 'video';
  timestamp: number;
  aspectRatio?: number;
  title?: string;
  description?: string;
  likes: Types.ObjectId[];
  comments: IComment[];
  geminiStory?: Record<string, string>;
  location?: ILocation;
  tags?: string[];
  collections?: Types.ObjectId[]; // Reference to collections this media belongs to
  featured: boolean; // Whether this item is featured
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Number, required: true },
}, { _id: true });

const locationSchema = new Schema<ILocation>({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  name: { type: String },
}, { _id: false });

const mediaItemSchema = new Schema<IMediaItem>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  uri: { type: String, required: true },
  type: { type: String, enum: ['photo', 'video'], required: true, index: true },
  aspectRatio: { type: Number },
  title: { type: String },
  description: { type: String },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
  comments: [commentSchema],
  geminiStory: { type: Schema.Types.Mixed },
  location: locationSchema,
  tags: [{ type: String, index: true }], // Legacy tags field - keeping for backward compatibility
  collections: [{ type: Schema.Types.ObjectId, ref: 'Collection', index: true }],
  featured: { type: Boolean, default: false, index: true }
}, { timestamps: true });

export default model<IMediaItem>('MediaItem', mediaItemSchema);
