import { Request, Response } from "express";
import { 
  getSeatsByEventId,
  getSeatById, 
  SeatStatus
} from "../models/seat.model";
import { seatQueue } from "../utils/queue/seatQueue";

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
    console.error("Error listing seats:", error);
    res.status(500).json({ error: "Internal server error." });
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
      res.status(404).json({ error: "Seat not found." });
      return;
    }
    res.json(seat);
  } catch (error) {
    console.error("Error retrieving seat:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}

/**
 * Hold a seat using queue-based processing for optimal performance during high load.
 * This endpoint queues the request and returns immediately with job information.
 * 
 * @function holdSeat
 * 
 * @param {Request} req - Express request object containing seatId, UUID in body
 * @param {Response} res - Express response object
 * @returns {Promise<void>} Responds with job ID and status endpoint
 */
export async function holdSeat(req: Request, res: Response): Promise<void> {
  try {
    const { id: seatId, UUID: userId } = req.body;

    if (!seatId || !userId) {
      res.status(400).json({ error: "Seat ID and User UUID are required." });
      return;
    }

    // Check if seat exists before queuing
    const seat = await getSeatById(seatId);
    if (!seat) {
      res.status(404).json({ error: "Seat not found." });
      return;
    }

    // Check if seat is available for holding
    if (seat.status !== SeatStatus.AVAILABLE) {
      res.status(409).json({ 
        error: "Seat is not available for holding.",
        currentStatus: seat.status 
      });
      return;
    }

    // Add to queue and return immediately
    const queueResponse = await seatQueue.enqueue("HOLD_SEAT", seatId, userId);
    
    res.status(202).json({
      message: "Seat hold request queued successfully",
      jobId: queueResponse.jobId,
      position: queueResponse.position,
      estimatedWaitTime: queueResponse.estimatedWaitTime,
      statusEndpoint: `/seats/job/${queueResponse.jobId}/status`
    });
  } catch (error) {
    console.error("Error queuing seat hold:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}

/**
 * Reserve a seat using queue-based processing for optimal performance during high load.
 * This endpoint queues the request and returns immediately with job information.
 * Seat must be On hold and the UUID must match.
 * 
 * @function reserveSeat
 * 
 * @param {Request} req - Express request object containing seatId and UUID in body
 * @param {Response} res - Express response object
 * @returns {Promise<void>} Responds with job ID and status endpoint
 */
export async function reserveSeat(req: Request, res: Response): Promise<void> {
  try {
    const { id: seatId, UUID: userId } = req.body;

    if (!seatId || !userId) {
      res.status(400).json({ error: "Seat ID and User UUID are required." });
      return;
    }

    // Check if seat exists before queuing
    const seat = await getSeatById(seatId);
    if (!seat) {
      res.status(404).json({ error: "Seat not found." });
      return;
    }

    // Check if seat is on hold
    if (seat.status !== SeatStatus.ONHOLD) {
      res.status(409).json({ 
        error: "Seat is not on hold.",
        currentStatus: seat.status 
      });
      return;
    }

    // Check if the user holds this seat
    if (seat.UUID !== userId) {
      res.status(403).json({ 
        error: "You do not hold this seat." 
      });
      return;
    }

    // Add to queue and return immediately
    const queueResponse = await seatQueue.enqueue("RESERVE_SEAT", seatId, userId);
    
    res.status(202).json({
      message: "Seat reservation request queued successfully",
      jobId: queueResponse.jobId,
      position: queueResponse.position,
      estimatedWaitTime: queueResponse.estimatedWaitTime,
      statusEndpoint: `/seats/job/${queueResponse.jobId}/status`
    });
  } catch (error) {
    console.error("Error queuing seat reservation:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}

/**
 * Get the status and result of a queued job
 * 
 * @function getJobStatus
 * 
 * @param {Request} req - Express request object containing jobId in params
 * @param {Response} res - Express response object
 * @returns {Promise<void>} Responds with job status and result
 */
export async function getJobStatus(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({ error: "Job ID is required." });
      return;
    }

    const result = await seatQueue.getJobResult(jobId);

    if (!result) {
      // Job might still be processing or doesn't exist
      res.status(404).json({ 
        error: "Job not found or still processing",
        jobId: jobId
      });
      return;
    }

    if (result.status === "completed") {
      res.status(200).json({
        status: "completed",
        result: result.result,
        completedAt: result.completedAt
      });
    } else if (result.status === "failed") {
      res.status(200).json({
        status: "failed",
        error: result.error,
        failedAt: result.failedAt
      });
    } else {
      // Job is still processing
      res.status(200).json({
        status: "processing",
        jobId: jobId
      });
    }
  } catch (error) {
    console.error("Error getting job status:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}

/**
 * Refresh the hold on a seat using queue-based processing.
 *
 * @function refreshHoldSeat
 * 
 * @param {Request} req - Express request object containing seat id and UUID in body
 * @param {Response} res - Express response object
 * @returns {Promise<void>} Responds with success message or error
 */
export async function refreshHoldSeat(req: Request, res: Response): Promise<void> {
  try {
    const { id, UUID } = req.body;
    const LOCK_EXPIRATION_TIME = Number(process.env.LOCK_EXPIRATION_TIME) || 60;
    const seat = await getSeatById(id);
    if (!seat) {
      res.status(404).json({ error: "Seat not found." });
      return;
    }
    if (seat.status !== SeatStatus.ONHOLD) {
      res.status(409).json({ error: "Seat is not On hold." });
      return;
    }
    if (seat.UUID !== UUID) {
      res.status(403).json({ error: "UUID does not match held seat." });
      return;
    }

    // For refresh, we can use direct processing since it's a simple operation
    // and doesn't involve complex seat allocation logic
    const { acquireSeatLock } = await import("../utils/seatLock");
    await acquireSeatLock(id, UUID, LOCK_EXPIRATION_TIME);
    res.json({ message: `Seat hold refreshed for seat ${seat.id}`});
  } catch (error) {
    console.error("Error refreshing seat hold:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}
