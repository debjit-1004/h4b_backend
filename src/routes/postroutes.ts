import { Router, Request, Response } from "express";
const router = Router();
import multer from "multer"; // Changed import
const upload = multer({ dest: 'uploads/' });
import { createposts } from "../controllers/postcontroller.js";

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Create a wrapper that properly types the request
const createPostsWrapper = (req: Request, res: Response, next: (err?: any) => void) => {
  // Cast req to include files from multer
  const multerReq = req as Request & { files?: Express.Multer.File[] };
  Promise.resolve(createposts(multerReq, res)).catch(next);
};

router.post("/createpost", upload.array('mediaFiles', 20), asyncHandler(createPostsWrapper));
export default router;