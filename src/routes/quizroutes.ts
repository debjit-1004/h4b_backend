import { Router } from 'express';
import { getQuizQuestion, submitQuizAnswer } from '../controllers/quizcontroller.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const router = Router();

router.get('/question', authMiddleware, getQuizQuestion);
router.post('/answer', authMiddleware, submitQuizAnswer);

export default router;
