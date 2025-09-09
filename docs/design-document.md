# Online Reservation System API - Design Document

## Overview
The online reservation system API provides endpoints for creating events and reserving seats. It contains additional endpoints for placing seats On hold for a configurable period of time, restricting users to a number of On hold seats and reserving the seat. It also contains an endpoint for listing the available seats for an event. The system uses Redis-backed job queues to handle seat holds and reservations asynchronously.

Key features:
- **Asynchronous Processing**: Seat hold/reserve operations are queued and processed by background workers
- **Scalable Architecture**: Separate server and worker processes for optimal resource utilization
- **Distributed Locking**: Distributed locking mechanism with Redis keyspace notifications for holding seats

For development purposes it contains additional endpoints for getting individual events and seats.

## Architecture

**Updated Architecture Diagram:**

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    Client Layer                                    │
├────────────────────────────────────────────────────────────────────────────────────┤
│  Web Clients  │  Mobile Apps  │  API Consumers  │  Testing Tools    │
└─────────────────────┬───────────────────────────────────────────────────────────────┘
                      │ HTTP/HTTPS Requests
                      │ (JSON payloads)
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Docker Container (app)                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                    Node.js Application (Multi-Process)                             │
│                              (TypeScript)                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                              Main Server Process                                   │
│                           (src/index.ts → port 3000)                              │
├─────────────────┬──────────────┬──────────────┬──────────────┬────────────────────┤
│   Routes        │ Controllers  │ Middleware   │ Models       │ Queue Producers    │
│                 │              │              │              │                    │
│ • events.route  │ • events     │ • redis      │ • event      │ • Job enqueueing   │
│ • seats.route   │ • seats      │   keyspace   │ • seat       │ • Status endpoints │
│                 │              │   notifications│             │                    │
├─────────────────┴──────────────┴──────────────┴──────────────┴────────────────────┤
│                       Queue Worker Processes (5 workers)                          │
│                        (src/worker.ts → background)                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│              Job Processors    │  Queue Management   │  Cleanup Services         │
│                               │                     │                            │
│ • HOLD_SEAT operations        │ • Custom Redis queues     │ • Expired job cleanup     │
│ • RESERVE_SEAT operations     │ • Job retries       │ • Automatic restarts      │
│ • Result storage              │ • Concurrency ctrl │                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                              Data Access Layer                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│            Main Redis Client             │        Queue Redis Client              │
│         (database/redisClient.ts)        │     (database/queueRedisClient.ts)     │
└─────────────────────────────┬────────────┴─────────────────────────────┬───────────┘
                              │ Redis Protocol                           │
                              │ TCP Connections                          │
                              ▼                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            Docker Container (redis)                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                               Redis Server                                         │
│                              (Version 7 Alpine)                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                           Data Storage & Queuing                                   │
├────────────────────┬─────────────────────┬────────────────────┬─────────────────────┤
│  Application Data  │  Queue Storage      │  Job Results       │  Expiring Keys      │
│                    │                     │                    │                     │
│  • event:{id}      │ • queue:seat_operations    │ • job:{id}:result  │ • seat:{id}:lock   │
│    - name          │   - job data        │   - status         │   - TTL for holds  │
│    - totalSeats    │   - priorities      │   - success        │   - UUID ownership │
│                    │   - delays          │   - error info     │                    │
│  • seat:{id}       │ • queue:seat_operations:     │ • job:{id}:meta    │  Keyspace Notify   │
│    - eventId       │   completed         │   - timestamps     │ • Expired events   │
│    - UUID          │   failed            │   - position       │ • Auto cleanup     │
│    - status        │   active            │                    │                    │
│                    │   waiting           │                    │                    │
│  • event:{id}:     │                     │                    │                    │
│    seats (set)     │                     │                    │                    │
└────────────────────┴─────────────────────┴────────────────────┴─────────────────────┘

                              ┌─────────────────────────────────────────────┐
                              │              External Tools                 │
                              ├─────────────────────────────────────────────┤
                              │ • Docker & Docker Compose                  │
                              │ • OpenAPI 3.0 Specification               │
                              │ • Jest Testing Framework                   │
                              │ • TypeScript Compiler                     │
                              │ • Structured Logging (logs/ directory)    │
                              └─────────────────────────────────────────────┘
```

**Technology Stack:**
- **Backend:** Node.js + Express (TypeScript)
- **Queue System:** Custom Redis-based queue implementation
- **Datastore:** Redis 7 (for events, seats, queues, job results)
- **Containerization:** Docker & Docker Compose with bridge networking
- **API Documentation:** OpenAPI 3.0 (YAML)
- **Testing:** Jest with TypeScript support
- **Development:** ts-node-dev with hot reloading
- **Logging:** Structured file-based logging in `logs/` directory
- **Process Management:** Multi-process architecture (server + workers)

**Asynchronous Data Flow:**
```
Client Request → Validation → Queue Job → Background Worker → Result Storage → Status API
     ↓               ↓           ↓              ↓                 ↓           ↓
   ⚡Fast        ✅ Errors    📋 Queue      🔄 Processing      💾 Redis     📊 Status
  Response      Immediately   Position      Concurrently      Results      Polling
     |                          |              |                |            |
 202 Accepted              jobId + position    5 workers     success/error   GET status
```

## Key Components

### 1. Event Management (Synchronous)
- Create events with a name and total seat count
- Store event data in Redis as hashes
- Validate seat limits (10-10,000)

### 2. Seat Management (Asynchronous)
- Seats are created in batches for each event.
- Each seat is a Redis hash with status (Available, On hold, Reserved).
- Seats are linked to events via Redis sets.

### 3. Reservation Workflow
- **Hold:** User can hold a specific number of seats. This is configurable and defaults to 6.
- **Lock:** Redis key with expiration for distributed locking.
- **Refresh Hold:** User can refresh the lock to extend hold.
- **Reserve:** Only seats On hold and matching UUID can be reserved.
- **Release:** Lock is released on reservation or expiration.

### 4. Queue System
#### Queue Producer (Main Server)

#### Queue Implementation
The queue system is built using native Redis data structures:

**Core Components:**
- **Queue Storage**: Redis list (`queue:seat_operations`) for FIFO job ordering
- **Processing Tracking**: Redis hash (`processing:seat_operations`) for active jobs
- **Result Storage**: Redis hash (`result:seat_operations`) with TTL for job results

#### Queue Workers (Background Processes)  
- **Multi-Worker Setup**: 5 concurrent worker processes
- **Job Processing**: Handle HOLD_SEAT and RESERVE_SEAT operations
- **Result Storage**: Store job results in Redis with TTL
- **Error Handling**: Comprehensive error handling and logging
- **Cleanup Jobs**: Automatic cleanup of expired holds and jobs

#### Job Lifecycle
1. **Enqueue**: Job added to Redis queue with unique ID
2. **Processing**: Worker picks up job and processes
3. **Result Storage**: Success/failure result stored in Redis
4. **Status Updates**: Job status available via API
5. **Cleanup**: Expired jobs automatically removed

### 5. API Endpoints

#### Events (Synchronous)
- `POST /events/create` - Create event
- `GET /events/{id}` - Get event by ID

#### Seats (Mixed Sync/Async)
- `GET /seats/list/{eventId}` - List available seats (sync)
- `GET /seats/get/{id}` - Get seat by ID (sync)
- `POST /seats/hold` - Hold a seat (async - returns job ID)
- `POST /seats/refresh` - Refresh seat hold (sync)
- `POST /seats/reserve` - Reserve a seat (async - returns job ID)

#### Job Status (Synchronous)
- `GET /seats/job/{jobId}/status` - Get job status and results

### 5. Configuration
- `.env` file for max held seats and lock expiration.
- Docker Compose for service orchestration.

### 6. Project Structure Updates
```
fabacus-online-reservation-system/
├── src/                          # Source code directory
│   ├── index.ts                 # Main server process
│   └── worker.ts                # Queue worker process
├── logs/                        # Log files directory
│   ├── server.log              # Main server logs
│   └── worker.log              # Worker process logs
├── database/
│   ├── redisClient.ts          # Main Redis connection
│   └── queueRedisClient.ts     # Queue-specific Redis connection
├── utils/queue/
│   ├── queueWorker.ts          # Worker implementation
│   └── seatQueue.ts            # Custom queue implementation
│   └── jobTypes.ts             # Job type definitions
├── docs/
│   ├── openapi.yaml            # Updated API spec with async endpoints
│   └── design-document.md      # This document
└── start.sh                    # Process startup script
```

## Data Structures

### Data Models

#### Event
```typescript
{
  id: string,           // Unique identifier for the event
  name: string,         // Name of the event
  totalSeats: number    // Total number of seats (10-10,000)
}
```

#### Seat
```typescript
{
  id: string,           // Unique identifier for the seat
  eventId: string,      // References the event's ID
  UUID: string,         // References the user's UUID (empty if not held)
  status: "Available" | "On hold" | "Reserved" // Current status of the seat
}
```

#### Queue Job
```typescript
{
  id: string,           // Unique job identifier
  type: "HOLD_SEAT" | "RESERVE_SEAT",
  data: {
    seatId: string,
    userUUID: string
  },
  status: "waiting" | "active" | "completed" | "failed",
  result?: {
    success: boolean,
    message: string,
    seat?: Seat,
    error?: string
  },
  createdAt: number,
  completedAt?: number
}
```

#### Queue Response
```typescript
{
  message: string,           // Success message
  jobId: string,            // Job tracking ID
  position: number,         // Position in queue
  estimatedWaitTime: number, // Estimated wait in seconds
  statusEndpoint: string    // URL to check job status
}
```

### Redis Data Model
- `event:{id}`: Event hash
- `event:{eventId}:seats`: Set of seat IDs for event  
- `queue:seat_operations`: Main job queue (Redis list)
- `processing:seat_operations`: Currently processing jobs (Redis hash)
- `result:seat_operations`: Job results storage (Redis hash with TTL)
- `job:{id}:meta`: Job metadata and timestamps

## Error Handling & Resilience

### Asynchronous Error Handling
- **Queue Failures**: Jobs retry automatically with exponential backoff
- **Worker Crashes**: Processes restart automatically via Docker
- **Redis Failures**: Connection retry logic with circuit breaker pattern
- **Job Timeouts**: Configurable timeout limits for long-running operations

### Status Codes
- **202 Accepted**: For successfully queued async operations
- **200 OK**: For completed sync operations and successful status queries
- **404 Not Found**: For job not found or expired
- **409 Conflict**: For seat already held/reserved
- **422 Unprocessable Entity**: For validation errors
- **500 Internal Server Error**: For system failures

## Future Improvements
- **Horizontal Scaling**: Multiple worker instances across containers
- **Advanced Queue Features**: Priority queues, delayed jobs, job batching
- **Authentication**: JWT-based user authentication and authorization
- **Rate Limiting**: Per-user rate limiting for API endpoints
- **Caching Layer**: Redis caching for frequently accessed data
- **Event Streaming**: Real-time notifications for seat status changes
