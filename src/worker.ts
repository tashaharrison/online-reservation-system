#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { queueWorker } from "../utils/queue/queueWorker";
import queueRedisClient from "../database/queueRedisClient";
import redisClient from "../database/redisClient";

/**
 * Standalone Queue Worker Process
 */

async function startWorker() {
  console.log("🚀 Starting Seat Operations Queue Worker...");
  
  try {
    // Connect to both Redis clients
    await redisClient.connect();
    await queueRedisClient.connect();
    console.log("✅ Connected to Redis");
    
    // Start the queue worker
    await queueWorker.start();
    console.log("✅ Queue worker started successfully");
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log("\n⏹️  Gracefully shutting down worker...");
      queueWorker.stop();
      await queueRedisClient.quit();
      await redisClient.quit();
      console.log("✅ Worker stopped");
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log("\n⏹️  Received SIGTERM, shutting down worker...");
      queueWorker.stop();
      await queueRedisClient.quit();
      await redisClient.quit();
      console.log("✅ Worker stopped");
      process.exit(0);
    });
    
  } catch (error) {
    console.error("❌ Failed to start worker:", error);
    process.exit(1);
  }
}

// Create logs directory if it doesn't exist when running standalone
if (require.main === module) {
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  startWorker();
}

export default startWorker;
