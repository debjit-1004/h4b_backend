import { Router } from 'express';
import { 
  initializeVectorIndexes,
  searchSimilarPosts,
  searchSimilarEvents,
  searchSimilarMedia,
  generatePostEmbeddingsController,
  generateMediaEmbeddingsController,
  generateEventEmbeddingsController
} from '../controllers/vectorSearchController.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const router = Router();

// Middleware for async error handling
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Admin auth middleware
const adminAuth = (req: any, res: any, next: any) => {
  authMiddleware(req, res, (err?: any) => {
    if (err) return next(err);
    
    // Add admin check here if needed
    next();
  });
};

// Initialize vector indexes (admin only)
router.post('/initialize', adminAuth, asyncHandler(initializeVectorIndexes));

// Search endpoints (public)
router.post('/search/posts', asyncHandler(searchSimilarPosts));
router.post('/search/events', asyncHandler(searchSimilarEvents));
router.post('/search/media', asyncHandler(searchSimilarMedia));

// Generate embeddings (admin only)
router.post('/embeddings/post/:postId', adminAuth, asyncHandler(generatePostEmbeddingsController));
router.post('/embeddings/media/:mediaId', adminAuth, asyncHandler(generateMediaEmbeddingsController));
router.post('/embeddings/event/:eventId', adminAuth, asyncHandler(generateEventEmbeddingsController));

export default router;
