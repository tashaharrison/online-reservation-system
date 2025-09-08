import { Request, Response } from 'express';
import { 
	getSeatsByEventId,
	getSeatById, 
	saveSeatToRedis, 
	SeatStatus
} from '../models/seat.model';
import { acquireSeatLock, isSeatLocked } from '../utils/seatLock';

/**
 * List all seats for a given event.
 * 
 * @function listSeats
 * 
 * @param {Request} req - Express request object containing eventId in params
 * @param {Response} res - Express response object
 * @returns {Promise<void>} Responds with seats array and total count
 */
export async function listSeats(req: Request, res: Response): Promise<void> {
	try {
		const { eventId } = req.params;
		const seats = await getSeatsByEventId(eventId);
		res.json(seats);
	} catch (error) {
		console.error('Error listing seats:', error);
		res.status(500).json({ error: 'Internal server error.' });
	}
}

/**
 * Retrieve a single seat by its ID.
 *
 * @function getSeat
 * 
 * @param {Request} req Express request object containing seatId in params
 * @param {Response} res Express response object
 * @returns {Promise<void>} Responds with seat object or error
 */
export async function getSeat(req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const seat = await getSeatById(id);
		if (!seat) {
			res.status(404).json({ error: 'Seat not found.' });
			return;
		}
		res.json(seat);
	} catch (error) {
		console.error('Error retrieving seat:', error);
		res.status(500).json({ error: 'Internal server error.' });
	}
}

/**
 * Hold a seat for a configured amount of time (default 60s).
 * 
 * @function holdSeat
 * 
 * @param {Request} req - Express request object containing seatId, UUID, and optional LOCK_EXPIRATION_TIME in body
 * @param {Response} res - Express response object
 * @returns {Promise<void>} Responds with success message and held seat, or error if unavailable/locked
 */
export async function holdSeat(req: Request, res: Response): Promise<void> {
	try {
		const { id, UUID, LOCK_EXPIRATION_TIME = 60 } = req.body;
		// Find the seat by seatId
		const seat = await getSeatById(id);
		if (!seat) {
			res.status(404).json({ error: 'Seat not found.' });
			return;
		}
		if (seat.status !== SeatStatus.AVAILABLE) {
			res.status(409).json({ error: 'Seat is not available.' });
			return;
		}

		// Check if the seat is locked and update seat accordingly
    const lockResult = await acquireSeatLock(id, UUID, LOCK_EXPIRATION_TIME);
    if (lockResult !== 'OK') {
      res.status(423).json({ error: 'Seat is already locked.' });
      return;
    }
		seat.UUID = UUID;
		seat.status = SeatStatus.ONHOLD;
		await saveSeatToRedis(seat, res);
		res.json({ message: `Seat held for ${LOCK_EXPIRATION_TIME} seconds.`, seat });
	} catch (error) {
		console.error('Error holding seat:', error);
		res.status(500).json({ error: 'Internal server error.' });
	}
}

/**
 * Reserve a seat (finalize reservation for a held seat).
 * 
 * @function reserveSeat
 * 
 * @param {Request} req - Express request object containing seatId and UUID in body
 * @param {Response} res - Express response object
 * @returns {Promise<void>} Responds with reservation confirmation or error
 */
export async function reserveSeat(req: Request, res: Response): Promise<void> {
	// TODO: Implement reservation logic
}
