import { Request, Response } from 'express';
import {
  initializeBengaliVectorIndexes,
  findSimilarPosts,
  findSimilarEvents,
  findSimilarMedia,
  generatePostEmbeddings,
  generateMediaEmbeddings,
  generateEventEmbeddings
} from '../utils/bengaliVectorSearch.js';

/**
 * Initialize vector indexes for Bengali Heritage platform
 */
export const initializeVectorIndexes = async (req: Request, res: Response) => {
  try {
    // Verify admin permissions
    // This is a placeholder - implement proper authorization check
    const user = await req.civicAuth?.getUser();
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const result = await initializeBengaliVectorIndexes();
    
    if (result.success) {
      return res.status(200).json({
        message: 'Bengali Heritage vector indexes initialized successfully'
      });
    } else {
      return res.status(500).json({
        message: 'Failed to initialize vector indexes',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error initializing vector indexes:', error);
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Find similar posts using vector search
 */
export const searchSimilarPosts = async (req: Request, res: Response) => {
  try {
    const { 
      postId, 
      query, 
      embedType = 'text',
      userId,
      tags,
      summaryType,
      limit = 10,
      minScore = 0.7
    } = req.body;
    
    // Validate request
    if (!postId && !query) {
      return res.status(400).json({ 
        message: 'Either postId or query is required' 
      });
    }
    
    const results = await findSimilarPosts({
      postId,
      query,
      embedType: embedType as 'text' | 'multimodal' | 'cultural',
      userId,
      tags: Array.isArray(tags) ? tags : tags?.split(','),
      summaryType,
      limit: Number(limit),
      minScore: Number(minScore)
    });
    
    res.status(200).json(results);
  } catch (error) {
    console.error('Error finding similar posts:', error);
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Find similar events using vector search
 */
export const searchSimilarEvents = async (req: Request, res: Response) => {
  try {
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
    } = req.body;
    
    // Validate request
    if (!eventId && !query) {
      return res.status(400).json({ 
        message: 'Either eventId or query is required' 
      });
    }
    
    const results = await findSimilarEvents({
      eventId,
      query,
      embedType: embedType as 'text' | 'cultural',
      eventType,
      tags: Array.isArray(tags) ? tags : tags?.split(','),
      culturalTags: Array.isArray(culturalTags) ? culturalTags : culturalTags?.split(','),
      upcoming: upcoming === true || upcoming === 'true',
      limit: Number(limit),
      minScore: Number(minScore)
    });
    
    res.status(200).json(results);
  } catch (error) {
    console.error('Error finding similar events:', error);
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Find similar media using vector search
 */
export const searchSimilarMedia = async (req: Request, res: Response) => {
  try {
    const { 
      mediaId, 
      query,
      imageUrl,
      embedType = 'multimodal',
      mediaType,
      tags,
      limit = 10,
      minScore = 0.7
    } = req.body;
    
    // Validate request
    if (!mediaId && !query && !imageUrl) {
      return res.status(400).json({ 
        message: 'Either mediaId, query, or imageUrl is required' 
      });
    }
    
    const results = await findSimilarMedia({
      mediaId,
      query,
      imageUrl,
      embedType: embedType as 'visual' | 'text' | 'multimodal' | 'cultural',
      mediaType,
      tags: Array.isArray(tags) ? tags : tags?.split(','),
      limit: Number(limit),
      minScore: Number(minScore)
    });
    
    res.status(200).json(results);
  } catch (error) {
    console.error('Error finding similar media:', error);
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Generate embeddings for a post
 */
export const generatePostEmbeddingsController = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    
    if (!postId) {
      return res.status(400).json({ message: 'Post ID is required' });
    }
    
    const result = await generatePostEmbeddings(postId);
    
    if (result.success) {
      res.status(200).json({
        message: 'Post embeddings generated successfully',
        embeddings: result.embeddings
      });
    } else {
      res.status(500).json({
        message: 'Failed to generate post embeddings',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error generating post embeddings:', error);
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Generate embeddings for a media item
 */
export const generateMediaEmbeddingsController = async (req: Request, res: Response) => {
  try {
    const { mediaId } = req.params;
    
    if (!mediaId) {
      return res.status(400).json({ message: 'Media ID is required' });
    }
    
    const result = await generateMediaEmbeddings(mediaId);
    
    if (result.success) {
      res.status(200).json({
        message: 'Media embeddings generated successfully',
        embeddings: result.embeddings
      });
    } else {
      res.status(500).json({
        message: 'Failed to generate media embeddings',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error generating media embeddings:', error);
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Generate embeddings for an event
 */
export const generateEventEmbeddingsController = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    
    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }
    
    const result = await generateEventEmbeddings(eventId);
    
    if (result.success) {
      res.status(200).json({
        message: 'Event embeddings generated successfully',
        embeddings: result.embeddings
      });
    } else {
      res.status(500).json({
        message: 'Failed to generate event embeddings',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error generating event embeddings:', error);
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
