/**
 * Event model and validation logic.
 * Handles storing and retrieving events from Redis.
 */
import redisClient from '../database/redisClient';

/**
 * Event interface defining the structure of an event object.
 * 
 * id: Unique identifier for the event.
 * name: Name of the event.
 * totalSeats: Number of seats available for the event (must be between 10 and 10,000 inclusive).
 */
export interface Event {
  id: string; // Unique identifier for the event
  name: string;
  totalSeats: number; // Must be between 10 and 10,000 inclusive
}


/**
 * Validates an event object.
 * Checks that the event has a string id, string name, and totalSeats is a number between 10 and 10,000.
 * 
 * @param event - The event object to validate.
 * @returns True if the event is valid, false otherwise.
 */
export function isValidEvent(event: Event): boolean {
  return (
    typeof event.id === 'string' &&
    typeof event.name === 'string' &&
    typeof event.totalSeats === 'number' &&
    event.totalSeats >= 10 &&
    event.totalSeats <= 10000
  );
}

/**
 * Stores an event in Redis as a hash.
 * The event is saved under the key 'event:{id}' with its properties as hash fields.
 * 
 * @param event - The event object to store.
 */
export async function saveEventToRedis(event: Event): Promise<void> {
  await redisClient.hSet(`event:${event.id}`, {
    id: event.id,
    name: event.name,
    totalSeats: event.totalSeats.toString(),
  });
}

/**
 * Retrieves an event from Redis by its ID.
 * Fetches the hash stored under 'event:{id}' and returns it as an Event object.
 * 
 * @param id - The unique identifier of the event to retrieve.
 * @returns The event object if found, or null if not found.
 */
export async function getEventFromRedis(id: string): Promise<Event | null> {
  const data = await redisClient.hGetAll(`event:${id}`);
  if (!data || !data.id) return null;
  return {
    id: data.id,
    name: data.name,
    totalSeats: Number(data.totalSeats),
  };
}
