import { Request, Response } from 'express';
import { 
	getSeatsByEventId,
	getSeatById, 
	saveSeatToRedis, 
	SeatStatus
} from '../models/seat.model';
import { acquireSeatLock, releaseSeatLock } from '../utils/seatLock';
import { checkMaxSeats } from '../utils/checkMaxSeats';

/**
 * List all seats for a given event.
 * Returns the and a 500 error for a server error.
 * If there are no seats it returns an empty array. 
 * This is to reflect the fact that the event exists, but is sold out.
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
		const seats = await getSeatsByEventId(eventId, { availableOnly: true });
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
			const { id, UUID } = req.body;
	    const MAX_HELD_SEATS = Number(process.env.MAX_HELD_SEATS) || 6;
	    const LOCK_EXPIRATION_TIME = Number(process.env.LOCK_EXPIRATION_TIME) || 60;
      
      // Limit the max seats a user can have on hold.
      const heldSeatsCount = await checkMaxSeats(id, UUID);
      console.log('Held Seats: ', heldSeatsCount);
			if (heldSeatsCount >= MAX_HELD_SEATS) {
				res.status(429).json({ error: `User cannot hold more than ${MAX_HELD_SEATS} seats.` });
				return;
			}

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

			// Check if the seat is locked and update seat accordingly.
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
 * Reserve a seat.
 * Seat must be On hold and the UUID must match.
 * 
 * @function reserveSeat
 * 
 * @param {Request} req - Express request object containing seatId and UUID in body
 * @param {Response} res - Express response object
 * @returns {Promise<void>} Responds with reservation confirmation or error
 */
export async function reserveSeat(req: Request, res: Response): Promise<void> {
	try {
		const { id, UUID } = req.body;
		const seat = await getSeatById(id);
    // Check that we have a seat which exists and can legitimatly be saved
		if (!seat) {
			res.status(404).json({ error: 'Seat not found.' });
			return;
		}
		if (seat.status !== SeatStatus.ONHOLD) {
			res.status(403).json({ error: 'Seat is not On hold.' });
			return;
		}
		if (seat.UUID !== UUID) {
			res.status(403).json({ error: 'User is not holding this seat.' });
			return;
		}

    // Update the status and reserve.
		seat.status = SeatStatus.RESERVED;
		await saveSeatToRedis(seat, res);

		// Release the seat lock.
		await releaseSeatLock(id);
		res.json({ message: 'Seat reserved successfully.', seat });
	} catch (error) {
		console.error('Error reserving seat:', error);
		res.status(500).json({ error: 'Internal server error.' });
	}
}
