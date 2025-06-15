import { Router, Request, Response } from "express";
const router = Router();
import multer from "multer";
const upload = multer({ dest: 'uploads/' })
import { createposts } from "../controllers/postcontroller.js";

// Create a wrapper that properly types the request
const createPostsWrapper = (req: Request, res: Response) => {
  // Cast req to include files from multer
  const multerReq = req as Request & { files?: Express.Multer.File[] };
  return createposts(multerReq, res);
};

router.post("/createpost", upload.array('mediaFiles', 20), createPostsWrapper);

export default router;