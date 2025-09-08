import redisClient from '../database/redisClient';
import { getEventFromRedis } from './event.model';

/**
 * Seat model interface.
 * Represents a seat with a unique ID, references to an event, and a reservation.
 */

/**
 * Enum for seat status.
 */
export enum SeatStatus {
	AVAILABLE = 'Available',
	ONHOLD = 'On hold',
	RESERVED = 'Reserved',
}

/**
 * Seat interface defining the structure of a seat object.
 * 
 * id: Unique identifier for the seat.
 * eventId: References the event's ID.
 * UUID: References the user's UUID.
 * status: Status of the seat (available, held, reserved).
 */
export interface Seat {
	id: string; // Unique identifier for the seat
	eventId: string; // References the event's ID
	UUID: string; // References the user's UUID
	status: SeatStatus; // Status of the seat
}

/**
 * Validates a seat object.
 * Checks that all fields are non-empty strings and status is valid.
 * 
 * @param seat - The seat object to validate.
 * @returns True if valid, false otherwise.
 */
export function isValidSeat(seat: Seat): boolean {
	return (
		typeof seat.id === 'string' && seat.id.trim() !== '' &&
		typeof seat.eventId === 'string' && seat.eventId.trim() !== '' &&
		typeof seat.UUID === 'string' && seat.UUID.trim() !== '' &&
		Object.values(SeatStatus).includes(seat.status)
	);
}

/**
 * Saves a seat in Redis as a hash under key 'seat:{id}'.
 * 
 * @param seat - The seat object to save.
 */
export async function saveSeatToRedis(seat: Seat, res?: import('express').Response): Promise<void> {
	try {
		await redisClient.hSet(`seat:${seat.id}`, {
			id: seat.id,
			eventId: seat.eventId,
			UUID: seat.UUID,
			status: seat.status,
		});
		// Add seat ID to event's seat set for lookup
		await redisClient.sAdd(`event:${seat.eventId}:seats`, seat.id);
	} catch (error) {
		console.error('Error saving seat:', error);
		if (res) {
			res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : error });
		}
		throw error;
	}
}

/**
 * Retrieves all available seats for a given event ID and returns the event object.
 *
 * @param eventId - The event ID to look up seats for.
 * @returns An object containing:
 *   - seats: Array of available Seat objects
 *   - total: Number of available seats
 *   - event: The full event object or null if not found
 */
export async function getSeatsByEventId(eventId: string): Promise<{ seats: Seat[]; total: number; event: object | null }> {
		const seatIds = await redisClient.sMembers(`event:${eventId}:seats`);
		const seats: Seat [] = [];
		// Get event name.
		const event = await getEventFromRedis(eventId);
    console.log('Event data:', eventId);
		for (const id of seatIds) {
			const data = await redisClient.hGetAll(`seat:${id}`);
			if (data && data.id && data.status === SeatStatus.AVAILABLE) {
				seats.push({
					id: data.id,
					eventId: data.eventId,
					UUID: data.UUID,
					status: data.status as SeatStatus,
				});
			}
		}
		return { total: seats.length, event, seats };
}

/**
 * Retrieves a single seat by seat ID.
 * 
 * @param id - The seat ID to look up.
 * @returns The Seat object if found, or null if not found.
 */
export async function getSeatById(id: string): Promise<Seat | null> {
	const data = await redisClient.hGetAll(`seat:${id}`);
  if (!data || !data.id) return null;
  return {
    id: data.id,
    eventId: data.eventId,
    UUID: data.UUID,
    status: data.status as SeatStatus,
  };
}

