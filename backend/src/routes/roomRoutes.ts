import { Router } from 'express';
import { getRooms, createRoom } from '../controllers/roomController';
import { authenticateToken, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getRooms); // Authenticated users can view
router.post('/', authenticateToken, requireAdmin, createRoom); // Only admin can create

export default router;
