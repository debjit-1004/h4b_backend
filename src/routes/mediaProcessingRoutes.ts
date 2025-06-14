import { Router, Request, Response, NextFunction } from 'express';
import { processMediaWithGemini, suggestBengaliTags } from '../utils/mediaProcessor.js';
import { Types } from 'mongoose';
import MediaItem from '../models/MediaItem.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const router = Router();

// Helper function for processing media
async function processMedia(req: Request, res: Response): Promise<void> {
  try {
    const { mediaId } = req.params;
    
    // Get user info from Civic Auth
    const user = await req.civicAuth.getUser();
    if (!user) {
      res.status(401).json({ error: 'Unauthorized - User not authenticated' });
      return;
    }
    
    // Use a unique identifier from the user object
    const userId = String(user.id || user.email || 'unknown');
    
    // Check if media exists and belongs to the user
    const mediaItem = await MediaItem.findOne({
      _id: mediaId,
      userId
    });
    
    if (!mediaItem) {
      res.status(404).json({ error: 'Media item not found or access denied' });
      return;
    }
    
    // Process with Gemini
    const result = await processMediaWithGemini(mediaId, userId);
    
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    
    res.status(200).json({
      message: 'Media processed successfully',
      media: result.media,
      tags: result.tags,
      story: result.story
    });
  } catch (error) {
    console.error('Error processing media:', error);
    res.status(500).json({ 
      error: 'Failed to process media',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

// Helper function for suggesting tags
async function suggestTags(req: Request, res: Response): Promise<void> {
  try {
    const { query, limit } = req.query;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query parameter is required' });
      return;
    }
    
    const limitNum = limit ? parseInt(limit as string) : 10;
    const tags = await suggestBengaliTags(query, limitNum);
    
    res.status(200).json({ tags });
  } catch (error) {
    console.error('Error suggesting tags:', error);
    res.status(500).json({ 
      error: 'Failed to suggest tags',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

// Create a wrapped middleware function that handles async correctly
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom auth wrapper
const withAuth = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req, res, (err?: any) => {
    if (err) return next(err);
    return asyncHandler(fn)(req, res, next);
  });
};

// Process a media item with Gemini Vision
router.post('/media/:mediaId/process', withAuth(processMedia));

// Get tag suggestions
router.get('/tags/suggest', asyncHandler(suggestTags));

export default router;
