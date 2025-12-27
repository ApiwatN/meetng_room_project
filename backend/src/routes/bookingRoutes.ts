import { Router } from 'express';
import { createBooking, getMyBookings, cancelBooking } from '../controllers/bookingController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

router.post('/', authenticateToken, createBooking);
router.get('/my', authenticateToken, getMyBookings);
router.delete('/:id', authenticateToken, cancelBooking);

export default router;
