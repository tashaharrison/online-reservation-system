import fs from 'fs';
import path from 'path';
import redisClient from "../database/redisClient";
import queueRedisClient from "../database/queueRedisClient";
import { initRedisKeyspaceNotifications } from "../middleware/redisKeyspaceNotifications";
import express, { Application } from "express";
import eventsRouter from "../routes/events.route";
import seatsRouter from "../routes/seats.route";

// Set up the express server.
const app: Application = express();
const PORT = process.env.PORT || 3000;

// Define the endpoints.
app.use(express.json());
app.use("/events", eventsRouter);
app.use("/seats", seatsRouter);

// Start the application, connect both Redis clients and initiate the Redis Keyspace Notifications.
async function startServer() {
  try {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      console.log("📁 Created logs directory");
    }

    // Connect main Redis client.
    await redisClient.connect();
    console.log("✅ Connected to main Redis client");
    
    // Connect queue Redis client (needed for enqueueing jobs).
    await queueRedisClient.connect();
    console.log("✅ Connected to queue Redis client");
    
    await initRedisKeyspaceNotifications();
    console.log("✅ Redis keyspace notifications middleware initialized");
    
    app.listen(PORT, () => {
      console.log(`🌐 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("⏹️  Received SIGINT, shutting down gracefully...");
  await redisClient.quit();
  await queueRedisClient.quit();
  console.log("✅ Server stopped");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("⏹️  Received SIGTERM, shutting down gracefully...");
  await redisClient.quit();
  await queueRedisClient.quit();
  console.log("✅ Server stopped");
  process.exit(0);
});

startServer();
