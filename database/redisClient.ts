import { createClient } from "redis";

// Creates the redis client.
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || "redis",
    port: Number(process.env.REDIS_PORT) || 6379,
  },
});

// Handles redis errors.
redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
});


// Connects to redis
(async () => {
  await redisClient.connect();
})();

export default redisClient;
