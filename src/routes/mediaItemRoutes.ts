import { Router, Request, Response } from "express";
import multer from "multer";
import { authMiddleware } from "../middlewares/authmiddleware.js";
import { 
  createMediaItem, 
  getMediaItems, 
  getMediaItemById, 
  updateMediaItem, 
  deleteMediaItem 
} from "../controllers/mediaItemController.js";

const router = Router();

// Configure Multer for media uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/media/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images and videos only
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images and videos are allowed'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Async handler utility
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Create a wrapper that properly types the request
const createMediaItemWrapper = (req: Request, res: Response, next: (err?: any) => void) => {
  // Cast req to include files from multer
  const multerReq = req as Request & { files?: Express.Multer.File[] };
  Promise.resolve(createMediaItem(multerReq, res)).catch(next);
};

// CRUD Routes for MediaItems
router.post("/", upload.array('mediaFiles', 20), asyncHandler(createMediaItemWrapper));
router.get("/", asyncHandler(getMediaItems));
router.get("/:id", asyncHandler(getMediaItemById));
router.put("/:id", upload.single('mediaFile'), asyncHandler(updateMediaItem));
router.delete("/:id", asyncHandler(deleteMediaItem));

export default router;
