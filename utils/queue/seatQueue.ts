import queueRedisClient from "../../database/queueRedisClient";
import { v4 as uuidv4 } from "uuid";

export interface QueueJob {
  id: string;
  type: "HOLD_SEAT" | "RESERVE_SEAT";
  payload: {
    seatId: string;
    userId: string;
    timestamp: number;
  };
  retries: number;
  maxRetries: number;
}

export interface QueueResponse {
  jobId: string;
  position: number;
  estimatedWaitTime: number; // in seconds
}

/**
 * Redis-based queue for handling seat operations during high load
 */
export class SeatOperationQueue {
  private queueKey: string;
  private processingKey: string;
  private resultKey: string;
  private maxConcurrentJobs: number;
  private jobTimeout: number;

  constructor(
    queueName = "seat_operations",
    maxConcurrentJobs = 10,
    jobTimeout = 30000 // 30 seconds
  ) {
    this.queueKey = `queue:${queueName}`;
    this.processingKey = `processing:${queueName}`;
    this.resultKey = `result:${queueName}`;
    this.maxConcurrentJobs = maxConcurrentJobs;
    this.jobTimeout = jobTimeout;
  }

  /**
   * Add a job to the queue.
   */
  async enqueue(type: QueueJob["type"], seatId: string, userId: string): Promise<QueueResponse> {
    const jobId = uuidv4();
    const job: QueueJob = {
      id: jobId,
      type,
      payload: {
        seatId,
        userId,
        timestamp: Date.now()
      },
      retries: 0,
      maxRetries: 3
    };

    // Add job to Redis queue (FIFO).
    await queueRedisClient.lPush(this.queueKey, JSON.stringify(job));
    
    // Get position in queue.
    const queueLength = await queueRedisClient.lLen(this.queueKey);
    const currentlyProcessing = await queueRedisClient.hLen(this.processingKey);
    
    const position = Math.max(0, queueLength - currentlyProcessing);
    const estimatedWaitTime = Math.ceil(position / this.maxConcurrentJobs) * 5; // 5 seconds per batch

    return {
      jobId,
      position,
      estimatedWaitTime
    };
  }

  /**
   * Get next job from queue for processing.
   */
  async dequeue(): Promise<QueueJob | null> {
    const result = await queueRedisClient.blPop(this.queueKey, 1);
    
    if (!result) return null;

    try {
      const job = JSON.parse(result.element) as QueueJob;
      // Add to processing set.
      await queueRedisClient.hSet(this.processingKey, job.id, JSON.stringify(job));
      return job;
    } catch (error) {
      console.error("Failed to parse job data:", error);
      return null;
    }
  }

  /**
   * Mark job as completed and store result.
   */
  async completeJob(jobId: string, result: any): Promise<void> {
    // Remove from processing set.
    await queueRedisClient.hDel(this.processingKey, jobId);
    
    // Store result for client polling (with 5 minute TTL).
    await queueRedisClient.hSet(this.resultKey, jobId, JSON.stringify({
      status: "completed",
      result,
      completedAt: Date.now()
    }));
    await queueRedisClient.expire(`${this.resultKey}:${jobId}`, 300);
  }

  /**
   * Mark job as failed.
   */
  async failJob(jobId: string, error: string, job?: QueueJob): Promise<void> {
    // Remove from processing set.
    await queueRedisClient.hDel(this.processingKey, jobId);

    // Check if we should retry.
    if (job && job.retries < job.maxRetries) {
      job.retries++;
      await queueRedisClient.lPush(this.queueKey, JSON.stringify(job));
      return;
    }

    // Store failure result.
    await queueRedisClient.hSet(this.resultKey, jobId, JSON.stringify({
      status: "failed",
      error,
      failedAt: Date.now()
    }));
    await queueRedisClient.expire(`${this.resultKey}:${jobId}`, 300);
  }

  /**
   * Get job result (for client polling).
   */
  async getJobResult(jobId: string): Promise<any | null> {
    const result = await queueRedisClient.hGet(this.resultKey, jobId);
    return result ? JSON.parse(result) : null;
  }

  /**
   * Clean up expired processing jobs (should be run periodically).
   */
  async cleanupStaleJobs(): Promise<void> {
    const processingJobs = await queueRedisClient.hGetAll(this.processingKey);
    const now = Date.now();

    for (const [jobId, jobData] of Object.entries(processingJobs)) {
      try {
        const job: QueueJob = JSON.parse(jobData);
        if (now - job.payload.timestamp > this.jobTimeout) {
          console.log(`Cleaning up stale job: ${jobId}`);
          await this.failJob(jobId, "Job timeout", job);
        }
      } catch {
        // Remove invalid job data.
        await queueRedisClient.hDel(this.processingKey, jobId);
      }
    }
  }
}

export const seatQueue = new SeatOperationQueue();
