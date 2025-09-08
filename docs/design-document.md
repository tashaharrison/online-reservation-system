# Online Reservation System API - Design Document

## Overview
The online reservation system api provides endpoints for creating events and reserving seats. It contains additional endpoints for placing seats On hold for a configurable period of time, restricting users to a number of On hold seats and reserving the seat. It also contains an endpoint for listing the available seats for an event.

For development purposes it contains two extra endpoints for getting a single event and a single seat.

## Architecture

**Architecture Diagram:**

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    Client Layer                                    │
├────────────────────────────────────────────────────────────────────────────────────┤
│  Web Clients  │  Mobile Apps  │  API Consumers  │  Testing Tools (Postman/curl)   │
└─────────────────────┬───────────────────────────────────────────────────────────────┘
                      │ HTTP/HTTPS Requests
                      │ (JSON payloads)
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Docker Container (app)                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                           Node.js + Express Server                                 │
│                              (TypeScript)                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                              Application Layer                                     │
├─────────────────┬──────────────┬──────────────┬──────────────┬────────────────────┤
│   Routes        │ Controllers  │ Middleware   │ Models       │ Utilities          │
│                 │              │              │              │                    │
│ • events.route  │ • events     │ • redis      │ • event      │ • seatLock         │
│ • seats.route   │ • seats      │   keyspace   │ • seat       │ • checkMaxSeats    │
│                 │              │   notifications│             │                    │
├─────────────────┴──────────────┴──────────────┴──────────────┴────────────────────┤
│                              Data Access Layer                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                             Redis Client                                           │
│                           (redisClient.ts)                                         │
└─────────────────────────────┬───────────────────────────────────────────────────────┘
                              │ Redis Protocol
                              │ TCP Connection
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            Docker Container (redis)                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                               Redis Server                                         │
│                              (Version 7 Alpine)                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                              Data Structures                                       │
├─────────────────────────────┬─────────────────────┬───────────────────────────────┤
│  Hash Storage           │  Set Storage        │  Expiring Keys                    │
│                         │                     │                                   │
│  • event:{id}          │  • event:{id}:seats │  • seat:{id}:lock                │
│    - name              │    - seat_id_1       │    - TTL for holds               │
│    - totalSeats        │    - seat_id_2       │    - UUID for ownership          │
│                        │    - ...             │                                   │
│  • seat:{id}           │                      │  Keyspace Notifications          │
│    - eventId           │                      │  • Expired key events            │
│    - UUID              │                      │  • Automatic cleanup             │
│    - status            │                      │                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │  External Tools │
                              ├─────────────────┤
                              │ • Docker        │
                              │ • Docker Compose│
                              │ • OpenAPI Spec  │
                              │ • Jest Testing  │
                              └─────────────────┘
```

**Technology Stack:**
- **Backend:** Node.js + Express (TypeScript)
- **Datastore:** Redis 7 (for events, seats, distributed locks)
- **Containerization:** Docker & Docker Compose with bridge networking
- **API Documentation:** OpenAPI 3.0 (YAML)
- **Testing:** Jest with TypeScript support
- **Development:** ts-node-dev with hot reloading

## Key Components
### 1. Event Management
- Create events with a name and total seat count.
- Store event data in Redis as hashes.
- Validate seat limits (10-10,000).

### 2. Seat Management
- Seats are created in batches for each event.
- Each seat is a Redis hash with status (Available, On hold, Reserved).
- Seats are linked to events via Redis sets.

### 3. Reservation Workflow
- **Hold:** User can hold a specific number of seats. This is configurable and defaults to 6.
- **Lock:** Redis key with expiration for distributed locking.
- **Refresh Hold:** User can refresh the lock to extend hold.
- **Reserve:** Only seats On hold and matching UUID can be reserved.
- **Release:** Lock is released on reservation or expiration.

### 4. API Endpoints
- `/events/create` - Create event
- `/events/{id}` - Get event by ID
- `/seats/list/{eventId}` - List available seats
- `/seats/get/{id}` - Get seat by ID
- `/seats/hold` - Hold a seat
- `/seats/refresh` - Refresh seat hold
- `/seats/reserve` - Reserve a seat

### 5. Configuration
- `.env` file for max held seats and lock expiration.
- Docker Compose for service orchestration.

## Data Structures
### Data Models

#### Event
```
{
	id: string,           // Unique identifier for the event
	name: string,         // Name of the event
	totalSeats: number    // Total number of seats (10-10,000)
}
```

#### Seat
```
{
	id: string,           // Unique identifier for the seat
	eventId: string,      // References the event's ID
	UUID: string,         // References the user's UUID (empty if not held)
	status: "Available" | "On hold" | "Reserved" // Current status of the seat
}
```

### Redis Data Model
- `event:{id}`: Event hash
- `event:{eventId}:seats`: Set of seat IDs for event
- `seat:{id}`: Seat hash
- `seat:{id}:lock`: Lock key for seat hold

## Error Handling
- API returns status codes for not found, conflicts, max holds, and lock errors.

## Future Improvements
- Add authentication using JWT.
- Add extensive tests for automated testing.
- Implement rate limiting.
- Add centralised Error handling and a Logger for consistency.
- Add enhanced data validation for the redis data objects.
- Add validation on the API requests using the open api schema.
- Caching for the seat list, which would be invalidated by seat updates during busy times.
