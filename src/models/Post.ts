import { Schema, model, Document, Types } from 'mongoose';

export interface IPost extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title?: string;
  description?: string;
  mediaItems: Types.ObjectId[]; // References to MediaItem documents
  tags: string[];
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  likes: Types.ObjectId[];
  comments: {
    userId: Types.ObjectId;
    userName: string;
    text: string;
    timestamp: Date;
  }[];
  collections: Types.ObjectId[]; // Reference to collections this post belongs to
  featured: boolean;
  visibility: 'public' | 'private' | 'community';
  
  // Summary-related fields
  aiSummary?: {
    summary: string;
    hashtags: string[];
    mood: string;
    themes: string[];
    generatedAt: Date;
    summaryType: 'post' | 'cultural' | 'creative' | 'travel';
  };
  
  // Cultural context
  culturalContext?: {
    significance: string;
    historicalContext: string;
    preservation: string;
    period?: string;
  };
  
  // Creative context
  creativeContext?: {
    narrative: string;
    artisticElements: string[];
    genre?: string;
    inspiration?: string;
  };
  
  // Travel context
  travelContext?: {
    attractions: string[];
    recommendations: string[];
    travelTips: string[];
    season?: string;
    travelStyle?: string;
  };
  
  // Vector embeddings for similarity search
  textEmbedding?: number[];
  multimodalEmbedding?: number[];
  culturalEmbedding?: number[];
  
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  name: { type: String }
}, { _id: false });

const commentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: true });

const aiSummarySchema = new Schema({
  summary: { type: String, required: true },
  hashtags: [{ type: String }],
  mood: { type: String, default: 'neutral' },
  themes: [{ type: String }],
  generatedAt: { type: Date, default: Date.now },
  summaryType: { 
    type: String, 
    enum: ['post', 'cultural', 'creative', 'travel'], 
    default: 'post' 
  }
}, { _id: false });

const culturalContextSchema = new Schema({
  significance: { type: String },
  historicalContext: { type: String },
  preservation: { type: String },
  period: { type: String }
}, { _id: false });

const creativeContextSchema = new Schema({
  narrative: { type: String },
  artisticElements: [{ type: String }],
  genre: { type: String },
  inspiration: { type: String }
}, { _id: false });

const travelContextSchema = new Schema({
  attractions: [{ type: String }],
  recommendations: [{ type: String }],
  travelTips: [{ type: String }],
  season: { type: String },
  travelStyle: { type: String }
}, { _id: false });

const postSchema = new Schema<IPost>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, maxlength: 200 },
  description: { type: String, maxlength: 1000 },
  mediaItems: [{ type: Schema.Types.ObjectId, ref: 'MediaItem', required: true }],
  tags: [{ type: String, index: true }],
  location: locationSchema,
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  comments: [commentSchema],
  collections: [{ type: Schema.Types.ObjectId, ref: 'Collection' }],
  featured: { type: Boolean, default: false, index: true },
  visibility: { 
    type: String, 
    enum: ['public', 'private', 'community'], 
    default: 'public',
    index: true 
  },
  
  // AI Summary fields
  aiSummary: aiSummarySchema,
  culturalContext: culturalContextSchema,
  creativeContext: creativeContextSchema,
  travelContext: travelContextSchema,
  
  // Vector embeddings
  textEmbedding: {
    type: [Number],
    default: undefined,
    index: false
  },
  multimodalEmbedding: {
    type: [Number],
    default: undefined,
    index: false
  },
  culturalEmbedding: {
    type: [Number],
    default: undefined,
    index: false
  },
  
}, { 
  timestamps: true
});

// Add indexes for better query performance
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ featured: 1, visibility: 1 });
postSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
postSchema.index({ tags: 1 });
postSchema.index({ 'aiSummary.summaryType': 1 });

// Index for text search
postSchema.index({
  title: 'text',
  description: 'text',
  'aiSummary.summary': 'text',
  tags: 'text'
});

export default model<IPost>('Post', postSchema);
