import redisClient from "../database/redisClient";
import request from "supertest";
import express from "express";
import eventsRouter from "../routes/events.route";

jest.mock("../database/redisClient");

beforeAll(async () => {
  if (redisClient && typeof redisClient.connect === "function") {
    await redisClient.connect();
  }
});

afterAll(async () => {
  if (redisClient && typeof redisClient.quit === "function") {
    await redisClient.quit();
  }
});

describe("Events API", () => {
  const app = express();
  app.use(express.json());
  app.use("/events", eventsRouter);

  it("should create a new event with valid data", async () => {
    const response = await request(app)
      .post("/events/create")
      .send({ name: "Test Event", totalSeats: 100 });
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("id");
    expect(response.body.name).toBe("Test Event");
    expect(response.body.totalSeats).toBe(100);
  });

  it("should fail to create an event with invalid seat count", async () => {
    const response = await request(app)
      .post("/events/create")
      .send({ name: "Bad Event", totalSeats: 5 });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });

  it("should fail to create an event with missing name", async () => {
    const response = await request(app)
      .post("/events/create")
      .send({ totalSeats: 100 });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });
});
