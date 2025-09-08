import { Router } from 'express';
import { listSeats, getSeat, holdSeat, reserveSeat } from '../controllers/seats.controller';

const router = Router();

// List all seats for an event.
router.get('/list/:eventId', listSeats);

// Get a single seat.
router.get('/get/:id', getSeat);

// Hold a seat.
router.post('/hold', holdSeat);

// Reserve a seat.
router.post('/reserve', reserveSeat);

export default router;
