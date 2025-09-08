import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Event, isValidEvent, saveEventToRedis, getEventFromRedis } from '../models/event.model';

/**
 * Controller for creating a new event.
 * Validates the event data and stores it in Redis if valid.
 * Returns 201 on success, 400 for invalid data, and 500 for server errors.
 * 
 * @param req - Express request object containing event data in the body.
 * @param res - Express response object.
 */
export async function createEvent(req: Request, res: Response): Promise<void> {
  try {
    const { name, seatsAvailable } = req.body;
    const event: Event = {
      id: uuidv4(),
      name,
      seatsAvailable: Number(seatsAvailable),
    };

    if (!isValidEvent(event)) {
      res.status(400).json({ error: 'Invalid event data. Seats must be between 10 and 10,000.' });
      return;
    }

    await saveEventToRedis(event);
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * Controller for retrieving an event by ID.
 * Returns the event object if found, 404 if not found, and 500 for server errors.
 * 
 * @param req - Express request object containing event ID in params.
 * @param res - Express response object.
 */
export async function getEvent(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const event = await getEventFromRedis(id);
  if (!event) {
    res.status(404).json({ error: 'Event not found.' });
    return;
  }
  res.json(event);
}
