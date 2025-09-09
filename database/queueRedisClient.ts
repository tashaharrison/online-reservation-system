import { createClient } from "redis";

// Creates a separate Redis client for queue operations to avoid blocking the main client.
const queueRedisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || "redis",
    port: Number(process.env.REDIS_PORT) || 6379,
  },
});

// Handles redis errors.
queueRedisClient.on("error", (err) => {
  console.error("Queue Redis Client Error", err);
});

export default queueRedisClient;
