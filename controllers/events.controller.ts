import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { Event, isValidEvent, saveEventToRedis, getEventFromRedis } from "../models/event.model";
import { Seat, saveSeatToRedis, SeatStatus, createSeatsWithPipeline } from "../models/seat.model";

/**
 * Create a new event and its seats.
 * Each seat is stored in Redis using pipeline operations for optimal performance.
 * Pipeline operations significantly reduce Redis round-trip time for bulk operations.
 * Returns 201 on success, 400 for invalid data, and 500 for server errors.
 *
 * @function createEvent
 * 
 * @param {Request} req Express request object containing event data in body
 * @param {Response} res Express response object
 * @returns {Promise<void>} Responds with created event or error
 */
export async function createEvent(req: Request, res: Response): Promise<void> {
  try {
  const { name, totalSeats } = req.body;
    const event: Event = {
      id: uuidv4(),
      name,
      totalSeats: Number(totalSeats),
    };

    // Check is the event is valid and seats within the limits.
    if (!isValidEvent(event)) {
    res.status(400).json({ error: "Invalid event data. Total seats must be between 10 and 10,000." });
      return;
    }

    await saveEventToRedis(event);

    // Create seats.
    await createSeatsWithPipeline(event.id, event.totalSeats);

    console.log(`${event.totalSeats} seats created for: ${event.name}`);
    res.status(201).json(event);
  } catch (error) {
  console.error("Error creating event:", error);
  res.status(500).json({ error: "Internal server error." });
  }
}

/**
 * Retrieve an event by its ID.
 * Returns the event object if found, 404 if not found, and 500 for server errors.
 *
 * @function getEvent
 * 
 * @param {Request} req Express request object containing event ID in params
 * @param {Response} res Express response object
 * @returns {Promise<void>} Responds with event or error
 */
export async function getEvent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const event = await getEventFromRedis(id);
    if (!event) {
      res.status(404).json({ error: "Event not found." });
      return;
    }
    res.json(event);
  } catch (error) {
    console.error("Error retrieving event:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}
