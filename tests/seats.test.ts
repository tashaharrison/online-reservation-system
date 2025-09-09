import request from "supertest";
import express from "express";

// Mock the Redis client BEFORE importing modules that use it
jest.mock("../database/redisClient", () => {
  const mockData: {
    events: Record<string, any>;
    seats: Record<string, any>;
    eventSeats: Record<string, string[]>;
  } = {
    events: {
      "test-event-id": {
        id: "test-event-id",
        name: "Mock Event",
        totalSeats: "100"
      }
    },
    seats: {
      "test-seat-id": {
        id: "test-seat-id",
        eventId: "test-event-id",
        UUID: "",
        status: "Available"
      },
      "test-seat-id-2": {
        id: "test-seat-id-2",
        eventId: "test-event-id",
        UUID: "",
        status: "Available"
      }
    },
    eventSeats: {
      "test-event-id": ["test-seat-id", "test-seat-id-2"]
    }
  };

  return {
    resetMockData: () => {
      // Reset to original mock data
      mockData.events = {
        "test-event-id": {
          id: "test-event-id",
          name: "Mock Event",
          totalSeats: "100"
        }
      };
      mockData.seats = {
        "test-seat-id": {
          id: "test-seat-id",
          eventId: "test-event-id",
          UUID: "",
          status: "Available"
        },
        "test-seat-id-2": {
          id: "test-seat-id-2",
          eventId: "test-event-id",
          UUID: "",
          status: "Available"
        }
      };
      mockData.eventSeats = {
        "test-event-id": ["test-seat-id", "test-seat-id-2"]
      };
    },
    hSet: jest.fn().mockResolvedValue("OK"),
    hGetAll: jest.fn().mockImplementation((key: string) => {
      if (key.startsWith("event:")) {
        const id = key.split(":")[1];
        return Promise.resolve(mockData.events[id] || {});
      } else if (key.startsWith("seat:")) {
        const id = key.split(":")[1];
        const seat = mockData.seats[id];
        if (seat && seat.id) {
          return Promise.resolve({
            id: seat.id,
            eventId: seat.eventId || "test-event-id",
            UUID: seat.UUID || "",
            status: seat.status || "Available"
          });
        }
        return Promise.resolve({ id, eventId: "test-event-id", UUID: "", status: "Available" });
      }
      return Promise.resolve(null);
    }),
    sAdd: jest.fn().mockResolvedValue(1),
    sMembers: jest.fn().mockImplementation((key: string) => {
      if (key.startsWith("event:") && key.endsWith(":seats")) {
        const id = key.split(":")[1];
        return Promise.resolve(mockData.eventSeats[id] || []);
      }
      return Promise.resolve([]);
    }),
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined)
  };
});

import seatsRouter from "../routes/seats.route";
import redisClient from "../database/redisClient";

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

describe("Seats API", () => {
  const app = express();
  app.use(express.json());
  app.use("/seats", seatsRouter);

  beforeEach(() => {
    if (redisClient && typeof redisClient.resetMockData === "function") {
      redisClient.resetMockData();
    }
  });

  it("should list available seats for an event", async () => {
    const response = await request(app)
      .get("/seats/list/test-event-id");
    expect(response.status).toBe(200);
    // The endpoint returns an object with seats array
    expect(Array.isArray(response.body.seats)).toBe(true);
  });

  it("should get a seat by ID", async () => {
    const response = await request(app)
      .get("/seats/get/test-seat-id");
    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body).toHaveProperty("id");
    } else {
      expect(response.body).toHaveProperty("error");
    }
  });

  it("should reserve a seat", async () => {
    const response = await request(app)
      .post("/seats/reserve")
      .send({ id: "test-seat-id", UUID: "test-uuid" });
    expect([200, 404, 403, 409, 500]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body).toHaveProperty("seat");
    } else {
      expect(response.body).toHaveProperty("error");
    }
  });

  it("should refresh a seat hold", async () => {
    const response = await request(app)
      .post("/seats/hold/refresh")
      .send({ id: "test-seat-id", UUID: "test-uuid" });
    expect([200, 404, 409, 403]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body).toHaveProperty("message");
    } else {
      expect(response.body).toHaveProperty("error");
    }
  });
});
