import { getSeatById, getSeatsByEventId } from "../models/seat.model";
import { SeatStatus } from "../models/seat.model";

/**
 * Checks how many seats a user is currently holding for a given event.
 *
 * @function checkMaxSeats
 * @param {string} id - The event ID to check seats for
 * @param {string} UUID - The user's UUID
 * @returns {Promise<number>} The number of seats held by the user for the event
 */
export async function checkMaxSeats(id: string, UUID: string): Promise<number> {
  let heldSeatsCount = 0;
  const seat = await getSeatById(id);
  if (!seat) {
    throw new Error("Seat not found");
  }
  const { eventId } = seat;
  const { seats } = await getSeatsByEventId(eventId);
  for (const seat of seats) {
    if (seat && seat.UUID === UUID && seat.status === SeatStatus.ONHOLD) {
      heldSeatsCount++;
    }
  }
  return heldSeatsCount;
}