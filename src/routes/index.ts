import { Router } from 'express';
import postroutes from './postroutes.js';

const router = Router();

// Health check route
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Include post routes (they will be available at /api/posts/*)
router.use('/posts', postroutes);

export default router;
