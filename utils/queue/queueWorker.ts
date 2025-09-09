import { seatQueue, QueueJob } from "./seatQueue";
import { getSeatById, saveSeatToRedis, SeatStatus } from "../../models/seat.model";
import { acquireSeatLock, releaseSeatLock } from "../seatLock";
import { checkMaxSeats } from "../checkMaxSeats";

/**
 * Queue worker that processes seat operation jobs.
 */
export class SeatQueueWorker {
  private isRunning = false;
  private maxWorkers: number;

  constructor(maxWorkers = 5) {
    this.maxWorkers = maxWorkers;
  }

  /**
   * Start the queue worker.
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(`Starting ${this.maxWorkers} queue workers...`);

    // Start multiple workers
    for (let i = 0; i < this.maxWorkers; i++) {
      this.startWorker(i + 1);
    }

    // Start cleanup job (runs every 60 seconds)
    this.startCleanupJob();
  }

  /**
   * Stop the queue worker
   */
  stop(): void {
    this.isRunning = false;
    console.log("Stopping queue workers...");
  }

  /**
   * Start a single worker process
   */
  private async startWorker(workerId: number): Promise<void> {
    console.log(`Worker ${workerId} started`);

    while (this.isRunning) {
      try {
        const job = await seatQueue.dequeue();
        if (!job) continue; // No jobs available, try again

        console.log(`Worker ${workerId} processing job ${job.id} (${job.type})`);
        await this.processJob(job);

      } catch (error) {
        console.error(`Worker ${workerId} error:`, error);
        // Add small delay to prevent tight error loops
        await this.sleep(1000);
      }
    }

    console.log(`Worker ${workerId} stopped`);
  }

  /**
   * Process a single job
   */
  private async processJob(job: QueueJob): Promise<void> {
    try {
      let result;

      switch (job.type) {
        case "HOLD_SEAT":
          result = await this.processHoldSeat(job);
          break;
        case "RESERVE_SEAT":
          result = await this.processReserveSeat(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      await seatQueue.completeJob(job.id, result);
    } catch (error) {
      console.error(`Failed to process job ${job.id}:`, error);
      await seatQueue.failJob(job.id, error instanceof Error ? error.message : "Unknown error", job);
    }
  }

  /**
   * Process seat hold job
   */
  private async processHoldSeat(job: QueueJob): Promise<any> {
    const { seatId, userId } = job.payload;
    const MAX_HELD_SEATS = Number(process.env.MAX_HELD_SEATS) || 6;
    const LOCK_EXPIRATION_TIME = Number(process.env.LOCK_EXPIRATION_TIME) || 60;

    // Check max seats limit
    const heldSeatsCount = await checkMaxSeats(seatId, userId);
    if (heldSeatsCount >= MAX_HELD_SEATS) {
      return {
        success: false,
        error: `User cannot hold more than ${MAX_HELD_SEATS} seats.`,
        status: 429
      };
    }

    // Get seat
    const seat = await getSeatById(seatId);
    if (!seat) {
      return {
        success: false,
        error: "Seat not found.",
        status: 404
      };
    }

    if (seat.status !== SeatStatus.AVAILABLE) {
      return {
        success: false,
        error: "Seat is not available.",
        status: 409
      };
    }

    // Try to acquire lock
    const lockResult = await acquireSeatLock(seatId, userId, LOCK_EXPIRATION_TIME);
    if (lockResult !== "OK") {
      return {
        success: false,
        error: "Seat is already locked.",
        status: 423
      };
    }

    // Update seat status
    seat.UUID = userId;
    seat.status = SeatStatus.ONHOLD;
    await saveSeatToRedis(seat);

    return {
      success: true,
      message: `Seat held for ${LOCK_EXPIRATION_TIME} seconds.`,
      seat,
      status: 200
    };
  }

  /**
   * Process seat reservation job.
   */
  private async processReserveSeat(job: QueueJob): Promise<any> {
    const { seatId, userId } = job.payload;

    const seat = await getSeatById(seatId);
    if (!seat) {
      return {
        success: false,
        error: "Seat not found.",
        status: 404
      };
    }

    if (seat.status !== SeatStatus.ONHOLD) {
      return {
        success: false,
        error: "Seat is not On hold.",
        status: 403
      };
    }

    if (seat.UUID !== userId) {
      return {
        success: false,
        error: "User is not holding this seat.",
        status: 403
      };
    }

    // Update seat to reserved
    seat.status = SeatStatus.RESERVED;
    await saveSeatToRedis(seat);

    // Release the lock
    await releaseSeatLock(seatId);

    return {
      success: true,
      message: "Seat reserved successfully.",
      seat,
      status: 200
    };
  }

  /**
   * Start cleanup job for stale processing jobs
   */
  private async startCleanupJob(): Promise<void> {
    console.log("Starting cleanup job...");

    const runCleanup = async () => {
      if (!this.isRunning) return;

      try {
        await seatQueue.cleanupStaleJobs();
      } catch (error) {
        console.error("Cleanup job error:", error);
      }

      if (this.isRunning) {
        setTimeout(runCleanup, 60000); // Run every 60 seconds
      }
    };

    setTimeout(runCleanup, 60000); // Start after 60 seconds
  }

  /**
   * Utility sleep function.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const queueWorker = new SeatQueueWorker();
