import { MongoClient } from "mongodb";
import { getTextEmbedding, getMultimodalEmbedding } from "./vectorEmbeddings.js";
import mongoose from "mongoose";
import Post from "../models/Post.js";
import MediaItem from "../models/MediaItem.js";
import CommunityEvent from "../models/CommunityEvent.js";
import { Tag } from "../models/TagModels.js";

/**
 * Initialize vector indexes for all Bengali Heritage models
 */
export async function initializeBengaliVectorIndexes() {
  const client = new MongoClient(process.env.MONGODB_URI as string);
  
  try {
    await client.connect();
    console.log("Connected to MongoDB for vector index creation");
    
    const db = client.db();
    
    // Initialize each vector index
    await initializePostVectorIndex(db);
    await initializeMediaVectorIndex(db);
    await initializeEventVectorIndex(db);
    await initializeTagVectorIndex(db);
    
    console.log("All Bengali Heritage vector indexes initialized successfully");
    
    return { success: true, message: "All vector indexes created" };
  } catch (error) {
    console.error("Error initializing vector indexes:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  } finally {
    await client.close();
  }
}

/**
 * Create vector index for posts
 */
async function initializePostVectorIndex(db: any) {
  try {
    const collection = db.collection("posts");
    
    // Check if index already exists
    const indexes = await collection.listSearchIndexes().toArray();
    // Define interface for search index
    interface SearchIndex {
      name: string;
      [key: string]: any; // Allow for other properties MongoDB might return
    }
    
    if (indexes.some((idx: SearchIndex) => idx.name === "bengaliPostVectorIndex")) {
      console.log("Bengali post vector index already exists");
      return;
    }
    
    // Create the post vector index
    const result = await collection.createSearchIndex({
      name: "bengaliPostVectorIndex",
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            textEmbedding: {
              type: "vector",
              dimensions: 768,
              similarity: "cosine"
            },
            multimodalEmbedding: {
              type: "vector",
              dimensions: 768,
              similarity: "cosine"
            },
            culturalEmbedding: {
              type: "vector",
              dimensions: 768,
              similarity: "cosine"
            },
            userId: { type: "filter" },
            tags: { type: "filter" },
            visibility: { type: "filter" },
            "aiSummary.summaryType": { type: "filter" }
          }
        }
      }
    });
    
    console.log("Bengali post vector index created:", result);
  } catch (error) {
    console.error("Error creating post vector index:", error);
    throw error;
  }
}

/**
 * Create vector index for media items
 */
async function initializeMediaVectorIndex(db: any) {
  try {
    const collection = db.collection("mediaitems");
    
    // Check if index already exists
    const indexes = await collection.listSearchIndexes().toArray();
    // Define interface for search index
    interface SearchIndex {
        name: string;
        [key: string]: any; // Allow for other properties MongoDB might return
    }

    if (indexes.some((idx: SearchIndex) => idx.name === "bengaliMediaVectorIndex")) {
        console.log("Bengali media vector index already exists");
        return;
    }
    
    // Create the media vector index
    const result = await collection.createSearchIndex({
      name: "bengaliMediaVectorIndex",
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            visualEmbedding: {
              type: "vector",
              dimensions: 768,
              similarity: "cosine"
            },
            textEmbedding: {
              type: "vector",
              dimensions: 768,
              similarity: "cosine"
            },
            multimodalEmbedding: {
              type: "vector",
              dimensions: 768,
              similarity: "cosine"
            },
            culturalEmbedding: {
              type: "vector",
              dimensions: 768,
              similarity: "cosine"
            },
            type: { type: "filter" },
            tags: { type: "filter" },
            userId: { type: "filter" }
          }
        }
      }
    });
    
    console.log("Bengali media vector index created:", result);
  } catch (error) {
    console.error("Error creating media vector index:", error);
    throw error;
  }
}

/**
 * Create vector index for community events
 */
async function initializeEventVectorIndex(db: any) {
  try {
    const collection = db.collection("communityevents");
    
    // Check if index already exists
    const indexes = await collection.listSearchIndexes().toArray();
    // Define interface for search index
    interface SearchIndex {
      name: string;
      [key: string]: any; // Allow for other properties MongoDB might return
    }
    
    if (indexes.some((idx: SearchIndex) => idx.name === "bengaliEventVectorIndex")) {
      console.log("Bengali event vector index already exists");
      return;
    }
    
    // Create the event vector index
    const result = await collection.createSearchIndex({
      name: "bengaliEventVectorIndex",
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            textEmbedding: {
              type: "vector",
              dimensions: 768,
              similarity: "cosine"
            },
            culturalEmbedding: {
              type: "vector",
              dimensions: 768,
              similarity: "cosine"
            },
            eventType: { type: "filter" },
            tags: { type: "filter" },
            culturalTags: { type: "filter" },
            date: { type: "filter" },
            visibility: { type: "filter" }
          }
        }
      }
    });
    
    console.log("Bengali event vector index created:", result);
  } catch (error) {
    console.error("Error creating event vector index:", error);
    throw error;
  }
}

/**
 * Create vector index for tags
 */
async function initializeTagVectorIndex(db: any) {
  try {
    const collection = db.collection("tags");
    
    // Check if index already exists
    const indexes = await collection.listSearchIndexes().toArray();
    // Define interface for search index
    interface SearchIndex {
      name: string;
      [key: string]: any; // Allow for other properties MongoDB might return
    }
    
    if (indexes.some((idx: SearchIndex) => idx.name === "bengaliTagVectorIndex")) {
      console.log("Bengali tag vector index already exists");
      return;
    }
    
    // Create the tag vector index
    const result = await collection.createSearchIndex({
      name: "bengaliTagVectorIndex",
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            vectorEmbedding: {
              type: "vector",
              dimensions: 768,
              similarity: "cosine"
            },
            category: { type: "filter" },
            isSystemGenerated: { type: "filter" }
          }
        }
      }
    });
    
    console.log("Bengali tag vector index created:", result);
  } catch (error) {
    console.error("Error creating tag vector index:", error);
    throw error;
  }
}

/**
 * Find similar posts based on vector embedding
 */
export async function findSimilarPosts(options: {
  postId?: string;
  query?: string;
  embedType?: 'text' | 'multimodal' | 'cultural';
  userId?: string;
  tags?: string[];
  summaryType?: string;
  limit?: number;
  minScore?: number;
}) {
  const { 
    postId, 
    query, 
    embedType = 'text', 
    userId, 
    tags, 
    summaryType,
    limit = 10, 
    minScore = 0.7 
  } = options;
  
  if (!postId && !query) {
    throw new Error("Either postId or query is required");
  }
  
  let queryVector: number[];
  
  // Get query vector from post or generate from text query
  if (postId) {
    const post = await Post.findById(postId);
    if (!post) {
      throw new Error("Post not found");
    }
    
    const embeddingField = `${embedType}Embedding`;
    queryVector = post[embeddingField as keyof typeof post] as number[];
    
    if (!queryVector || queryVector.length === 0) {
      throw new Error(`Post does not have ${embedType} embedding`);
    }
  } else if (query) {
    // Generate embedding based on embed type
    if (embedType === 'text') {
      queryVector = await getTextEmbedding(query);
    } else {
      // Default to text embedding for query strings
      queryVector = await getTextEmbedding(query);
    }
  } else {
    throw new Error("Invalid search parameters");
  }
  
  // Execute vector search
  const client = new MongoClient(process.env.MONGODB_URI as string);
  
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection("posts");
    
    // Build filters
    const filter: any = { visibility: "public" };
    if (userId) filter.userId = new mongoose.Types.ObjectId(userId);
    if (tags && tags.length > 0) filter.tags = { $in: tags };
    if (summaryType) filter["aiSummary.summaryType"] = summaryType;
    
    // Determine the embedding field to search
    const embedField = `${embedType}Embedding`;
    
    // Build aggregation pipeline with vector search
    const pipeline = [
      {
        $vectorSearch: {
          index: "bengaliPostVectorIndex",
          path: embedField,
          queryVector: queryVector,
          numCandidates: limit * 3,
          limit: limit,
          filter: filter
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          tags: 1,
          mediaItems: 1,
          aiSummary: 1,
          culturalContext: 1,
          creativeContext: 1,
          travelContext: 1,
          userId: 1,
          createdAt: 1,
          score: { $meta: "vectorSearchScore" }
        }
      },
      {
        $match: {
          score: { $gte: minScore }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "mediaitems",
          localField: "mediaItems",
          foreignField: "_id",
          as: "mediaItems"
        }
      }
    ];
    
    const cursor = collection.aggregate(pipeline);
    const results = await cursor.toArray();
    
    return {
      posts: results,
      count: results.length
    };
  } catch (error) {
    console.error("Error finding similar posts:", error);
    throw error;
  } finally {
    await client.close();
  }
}

/**
 * Find similar events based on vector embedding
 */
export async function findSimilarEvents(options: {
  eventId?: string;
  query?: string;
  embedType?: 'text' | 'cultural';
  eventType?: string;
  tags?: string[];
  culturalTags?: string[];
  upcoming?: boolean;
  limit?: number;
  minScore?: number;
}) {
  const {
    eventId,
    query,
    embedType = 'text',
    eventType,
    tags,
    culturalTags,
    upcoming = true,
    limit = 10,
    minScore = 0.7
  } = options;
  
  if (!eventId && !query) {
    throw new Error("Either eventId or query is required");
  }
  
  let queryVector: number[];
  
  // Get query vector from event or generate from text query
  if (eventId) {
    const event = await CommunityEvent.findById(eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    
    const embeddingField = `${embedType}Embedding`;
    queryVector = event[embeddingField as keyof typeof event] as number[];
    
    if (!queryVector || queryVector.length === 0) {
      throw new Error(`Event does not have ${embedType} embedding`);
    }
  } else if (query) {
    queryVector = await getTextEmbedding(query);
  } else {
    throw new Error("Invalid search parameters");
  }
  
  // Execute vector search
  const client = new MongoClient(process.env.MONGODB_URI as string);
  
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection("communityevents");
    
    // Build filters
    const filter: any = { visibility: "public" };
    if (eventType) filter.eventType = eventType;
    if (tags && tags.length > 0) filter.tags = { $in: tags };
    if (culturalTags && culturalTags.length > 0) filter.culturalTags = { $in: culturalTags };
    
    // Filter for upcoming events if requested
    if (upcoming) {
      filter.date = { $gte: new Date() };
    }
    
    // Determine the embedding field to search
    const embedField = `${embedType}Embedding`;
    
    // Build aggregation pipeline with vector search
    const pipeline = [
      {
        $vectorSearch: {
          index: "bengaliEventVectorIndex",
          path: embedField,
          queryVector: queryVector,
          numCandidates: limit * 3,
          limit: limit,
          filter: filter
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          eventType: 1,
          date: 1,
          endDate: 1,
          location: 1,
          tags: 1,
          culturalTags: 1,
          aiSummary: 1,
          culturalSignificance: 1,
          organizerId: 1,
          coverImage: 1,
          status: 1,
          score: { $meta: "vectorSearchScore" }
        }
      },
      {
        $match: {
          score: { $gte: minScore }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "organizerId",
          foreignField: "_id",
          as: "organizer"
        }
      },
      {
        $unwind: {
          path: "$organizer",
          preserveNullAndEmptyArrays: true
        }
      }
    ];
    
    const cursor = collection.aggregate(pipeline);
    const results = await cursor.toArray();
    
    return {
      events: results,
      count: results.length
    };
  } catch (error) {
    console.error("Error finding similar events:", error);
    throw error;
  } finally {
    await client.close();
  }
}

/**
 * Find similar media items based on vector embedding
 */
export async function findSimilarMedia(options: {
  mediaId?: string;
  query?: string;
  imageUrl?: string;
  embedType?: 'visual' | 'text' | 'multimodal' | 'cultural';
  mediaType?: 'photo' | 'video';
  tags?: string[];
  limit?: number;
  minScore?: number;
}) {
  const {
    mediaId,
    query,
    imageUrl,
    embedType = 'multimodal',
    mediaType,
    tags,
    limit = 10,
    minScore = 0.7
  } = options;
  
  if (!mediaId && !query && !imageUrl) {
    throw new Error("Either mediaId, query, or imageUrl is required");
  }
  
  let queryVector: number[];
  
  // Get query vector from media item, generate from text query, or from image URL
  if (mediaId) {
    const media = await MediaItem.findById(mediaId);
    if (!media) {
      throw new Error("Media item not found");
    }
    
    const embeddingField = `${embedType}Embedding`;
    queryVector = media[embeddingField as keyof typeof media] as number[];
    
    if (!queryVector || queryVector.length === 0) {
      throw new Error(`Media does not have ${embedType} embedding`);
    }
  } else if (query) {
    queryVector = await getTextEmbedding(query);
  } else if (imageUrl) {
    // Use multimodal embedding for image URL
    queryVector = await getMultimodalEmbedding(imageUrl, '');
  } else {
    throw new Error("Invalid search parameters");
  }
  
  // Execute vector search
  const client = new MongoClient(process.env.MONGODB_URI as string);
  
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection("mediaitems");
    
    // Build filters
    const filter: any = {};
    if (mediaType) filter.type = mediaType;
    if (tags && tags.length > 0) filter.tags = { $in: tags };
    
    // Determine the embedding field to search
    const embedField = `${embedType}Embedding`;
    
    // Build aggregation pipeline with vector search
    const pipeline = [
      {
        $vectorSearch: {
          index: "bengaliMediaVectorIndex",
          path: embedField,
          queryVector: queryVector,
          numCandidates: limit * 3,
          limit: limit,
          filter: filter
        }
      },
      {
        $project: {
          _id: 1,
          uri: 1,
          type: 1,
          title: 1,
          description: 1,
          tags: 1,
          geminiStory: 1,
          culturalContext: 1,
          userId: 1,
          createdAt: 1,
          score: { $meta: "vectorSearchScore" }
        }
      },
      {
        $match: {
          score: { $gte: minScore }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true
        }
      }
    ];
    
    const cursor = collection.aggregate(pipeline);
    const results = await cursor.toArray();
    
    return {
      mediaItems: results,
      count: results.length
    };
  } catch (error) {
    console.error("Error finding similar media:", error);
    throw error;
  } finally {
    await client.close();
  }
}

/**
 * Generate embeddings for a Post
 */
export async function generatePostEmbeddings(postId: string) {
  try {
    const post = await Post.findById(postId).populate('mediaItems');
    if (!post) {
      throw new Error("Post not found");
    }
    
    // Generate text embedding
    const textContent = [
      post.title || '',
      post.description || '',
      post.tags.join(' '),
      post.aiSummary?.summary || '',
      post.aiSummary?.themes.join(' ') || ''
    ].filter(Boolean).join(' ');
    
    const textEmbedding = await getTextEmbedding(textContent);
    
    // Generate multimodal embedding if media exists
    let multimodalEmbedding;
    if (post.mediaItems && post.mediaItems.length > 0) {
      const primaryMedia = post.mediaItems[0];
      const multimodalContext = `${post.title || ''} ${post.description || ''} ${post.tags.join(' ')}`;
      multimodalEmbedding = await getMultimodalEmbedding(primaryMedia.uri, multimodalContext);
    }
    
    // Generate cultural embedding if cultural context exists
    let culturalEmbedding;
    if (post.culturalContext || post.aiSummary?.summaryType === 'cultural') {
      const culturalContent = [
        post.title || '',
        post.culturalContext?.significance || '',
        post.culturalContext?.historicalContext || '',
        post.aiSummary?.summary || ''
      ].filter(Boolean).join(' ');
      
      culturalEmbedding = await getTextEmbedding(culturalContent);
    }
    
    // Update post with embeddings
    const updateData: any = {};
    if (textEmbedding) updateData.textEmbedding = textEmbedding;
    if (multimodalEmbedding) updateData.multimodalEmbedding = multimodalEmbedding;
    if (culturalEmbedding) updateData.culturalEmbedding = culturalEmbedding;
    
    if (Object.keys(updateData).length > 0) {
      await Post.findByIdAndUpdate(postId, updateData);
    }
    
    return {
      success: true,
      embeddings: {
        text: !!textEmbedding,
        multimodal: !!multimodalEmbedding,
        cultural: !!culturalEmbedding
      }
    };
  } catch (error) {
    console.error("Error generating post embeddings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Generate embeddings for a MediaItem
 */
export async function generateMediaEmbeddings(mediaId: string) {
  try {
    const media = await MediaItem.findById(mediaId);
    if (!media) {
      throw new Error("Media item not found");
    }
    
    // Generate text embedding
    const textContent = [
      media.title || '',
      media.description || '',
      media.tags?.join(' ') || '',
      media.geminiStory?.story || ''
    ].filter(Boolean).join(' ');
    
    const textEmbedding = await getTextEmbedding(textContent);
    
    // Generate visual embedding
    const visualEmbedding = await getMultimodalEmbedding(media.uri, '');
    
    // Generate multimodal embedding
    const multimodalEmbedding = await getMultimodalEmbedding(
      media.uri,
      textContent
    );
    
    // Generate cultural embedding if applicable
    let culturalEmbedding;
    if (media.culturalContext || (media.geminiStory && 'culturalContext' in media.geminiStory)) {
      const culturalContent = [
        media.title || '',
        media.culturalContext?.significance || '',
        media.geminiStory?.culturalContext || ''
      ].filter(Boolean).join(' ');
      
      culturalEmbedding = await getTextEmbedding(culturalContent);
    }
    
    // Update media with embeddings
    const updateData: any = {};
    if (textEmbedding) updateData.textEmbedding = textEmbedding;
    if (visualEmbedding) updateData.visualEmbedding = visualEmbedding;
    if (multimodalEmbedding) updateData.multimodalEmbedding = multimodalEmbedding;
    if (culturalEmbedding) updateData.culturalEmbedding = culturalEmbedding;
    
    if (Object.keys(updateData).length > 0) {
      await MediaItem.findByIdAndUpdate(mediaId, updateData);
    }
    
    return {
      success: true,
      embeddings: {
        text: !!textEmbedding,
        visual: !!visualEmbedding,
        multimodal: !!multimodalEmbedding,
        cultural: !!culturalEmbedding
      }
    };
  } catch (error) {
    console.error("Error generating media embeddings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Generate embeddings for a CommunityEvent
 */
export async function generateEventEmbeddings(eventId: string) {
  try {
    const event = await CommunityEvent.findById(eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    
    // Generate text embedding
    const textContent = [
      event.name,
      event.description || '',
      event.eventType,
      event.tags.join(' '),
      event.culturalTags.join(' '),
      event.aiSummary?.summary || '',
      event.culturalSignificance?.heritage || ''
    ].filter(Boolean).join(' ');
    
    const textEmbedding = await getTextEmbedding(textContent);
    
    // Generate cultural embedding
    let culturalEmbedding;
    if (
      event.culturalSignificance || 
      event.aiSummary?.summary ||
      event.culturalTags.length > 0
    ) {
      const culturalContent = [
        event.name,
        event.culturalSignificance?.heritage || '',
        event.culturalTags.join(' '),
        event.aiSummary?.summary || ''
      ].filter(Boolean).join(' ');
      
      culturalEmbedding = await getTextEmbedding(culturalContent);
    }
    
    // Update event with embeddings
    const updateData: any = {};
    if (textEmbedding) updateData.textEmbedding = textEmbedding;
    if (culturalEmbedding) updateData.culturalEmbedding = culturalEmbedding;
    
    if (Object.keys(updateData).length > 0) {
      await CommunityEvent.findByIdAndUpdate(eventId, updateData);
    }
    
    return {
      success: true,
      embeddings: {
        text: !!textEmbedding,
        cultural: !!culturalEmbedding
      }
    };
  } catch (error) {
    console.error("Error generating event embeddings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
