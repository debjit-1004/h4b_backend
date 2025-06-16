import { Router, Request, Response } from "express";
const router = Router();
import multer from "multer";
const upload = multer({ dest: 'uploads/' })
import { 
  createposts, 
  getPosts, 
  generatePostSummaryEndpoint,
  createCommunityEvent,
  generateEventSummary,
  generateCollectionSummary
} from "../controllers/postcontroller.js";
import { authMiddleware } from "../middlewares/authmiddleware.js";

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Create a wrapper that properly types the request
const createPostsWrapper = (req: Request, res: Response, next: (err?: any) => void) => {
  // Cast req to include files from multer
  const multerReq = req as Request & { files?: Express.Multer.File[] };
  Promise.resolve(createposts(multerReq, res)).catch(next);
};

// Auth wrapper for protected routes
const withAuth = (fn: Function) => (req: Request, res: Response, next: (err?: any) => void) => {
  authMiddleware(req, res, (err?: any) => {
    if (err) return next(err);
    return asyncHandler(fn)(req, res, next);
  });
};

// Routes
router.post("/createpost", upload.array('mediaFiles', 20), asyncHandler(createPostsWrapper));

// Get posts with filtering options
router.get("/", asyncHandler(getPosts));

// Generate summary for existing post (protected)
router.get("/:postId/generate-summary", withAuth(generatePostSummaryEndpoint));

// Create community event (protected)
router.post("/events", withAuth(createCommunityEvent));

// Generate summary for community event (protected)
router.post("/events/:eventId/generate-summary", withAuth(generateEventSummary));

// Generate collection summary for multiple posts (protected)
router.post("/collections/generate-summary", withAuth(generateCollectionSummary));

export default router;