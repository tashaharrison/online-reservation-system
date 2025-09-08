import { Router, Request, Response } from 'express';
import { getSeatsByEventId, saveSeatToRedis, isValidSeat, Seat } from '../models/seat.model';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// List all seats for an event
router.get('/list/:eventId', async (req: Request, res: Response) => {
	try {
		const { eventId } = req.params;
		const seats = await getSeatsByEventId(eventId);
		res.json(seats);
	} catch (error) {
		console.error('Error listing seats:', error);
		res.status(500).json({ error: 'Internal server error.' });
	}
});

// Test endpoint to verify seats router
router.get('/test', (req: Request, res: Response) => {
	res.send('Hello World');
});

// Hold a seat (assign a UUID to a seat if available)
router.post('/hold', async (req: Request, res: Response) => {

});

// Reserve a seat (finalize reservation for a held seat)
router.post('/reserve', async (req: Request, res: Response) => {


});

export default router;
