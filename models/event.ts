export interface Event {
  id: string; // Unique identifier for the event
  name: string;
  seatsAvailable: number; // Must be between 10 and 10,000 inclusive
}

import redisClient from '../database/redisClient';

export function isValidEvent(event: Event): boolean {
  return (
    typeof event.id === 'string' &&
    typeof event.name === 'string' &&
    typeof event.seatsAvailable === 'number' &&
    event.seatsAvailable >= 10 &&
    event.seatsAvailable <= 10000
  );
}

// Store event in Redis as a hash
export async function saveEventToRedis(event: Event): Promise<void> {
  await redisClient.hSet(`event:${event.id}`, {
    id: event.id,
    name: event.name,
    seatsAvailable: event.seatsAvailable.toString(),
  });
}

// Retrieve event from Redis by ID
export async function getEventFromRedis(id: string): Promise<Event | null> {
  const data = await redisClient.hGetAll(`event:${id}`);
  if (!data || !data.id) return null;
  return {
    id: data.id,
    name: data.name,
    seatsAvailable: Number(data.seatsAvailable),
  };
}
