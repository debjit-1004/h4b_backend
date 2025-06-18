import { Router, Request, Response } from "express";
const router = Router();
import multer from "multer";
const upload = multer({ dest: 'uploads/' })
import { 
  createposts, 
  getPosts, 
  generatePostSummaryEndpoint
} from "../controllers/postcontroller.js";
import { authMiddleware } from "../middlewares/authmiddleware.js";
import {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost
} from "../controllers/postController.js";

// Configure Multer for post content uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/posts/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images and documents
  if (file.mimetype.startsWith('image/') || 
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'text/plain') {
    cb(null, true);
  } else {
    cb(new Error('Only images and documents are allowed'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Async handler utility
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// CRUD Routes for Posts
router.post("/", upload.array('attachments', 5), asyncHandler(createPost));
router.get("/", asyncHandler(getPosts));

// Generate summary for existing post (protected)
router.get("/:postId/generate-summary", withAuth(generatePostSummaryEndpoint));

export default router;