import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  res.json({ success: true, data: [], message: 'Module ready – implement full logic as needed' });
});

export default router;
