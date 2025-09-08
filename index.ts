import redisClient from "./database/redisClient";
import { initRedisKeyspaceNotifications } from "./middleware/redisKeyspaceNotifications";
import express, { Application } from "express";
import eventsRouter from "./routes/events.route";
import seatsRouter from "./routes/seats.route";

// Set up the express server.
const app: Application = express();
const PORT = process.env.PORT || 3000;

// Define the endpoints.
app.use(express.json());
app.use("/events", eventsRouter);
app.use("/seats", seatsRouter);

// Start the application and initiate the Redis Keyspace Notifications.

async function startServer() {
  try {
    await redisClient.connect();
    console.log("Connected to Redis");
    await initRedisKeyspaceNotifications();
    console.log("Redis keyspace notifications middleware initialized.");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
