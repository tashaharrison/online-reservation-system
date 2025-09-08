import { Router } from 'express';
import { listSeats, getSeat, holdSeat, reserveSeat, refreshHoldSeat } from '../controllers/seats.controller';

const router = Router();

// List all seats for an event.
router.get('/list/:eventId', listSeats);

// Get a single seat.
router.get('/get/:id', getSeat);

// Hold a seat.
router.post('/hold', holdSeat);

// Reserve a seat.
router.post('/reserve', reserveSeat);

// Refresh a hold.
router.post('/hold/refresh', refreshHoldSeat);

export default router;
