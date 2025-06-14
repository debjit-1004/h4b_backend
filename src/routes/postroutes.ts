import { Router } from "express";
const router = Router();
import multer from "multer";
const upload = multer({ dest: 'uploads/' })
import { createposts } from "../controllers/postcontroller.js";

router.post("/post", upload.array('mediaFiles', 20), createposts);

export default router;