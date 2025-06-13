import { Router } from 'express';

const router = Router();

// TODO: Add route imports and use them here

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;
