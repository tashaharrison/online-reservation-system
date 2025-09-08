# Online Reservation System

This is a Node.js + TypeScript application using Express and Redis for event management.

## Prerequisites
- Docker & Docker Compose
- Node.js (v20+ recommended)

## Setup

1. **Clone the repository:**
   ```bash
   git clone git@github.com:tashaharrison/online-reservation-system.git
   cd online-reservation-system
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start Redis and the app using Docker Compose:**
   ```bash
   docker compose up -d
   ```
   This will start both the Node.js app and Redis.

4. **Build the TypeScript code:**
   ```bash
   npm run build
   ```

5. **Run the application:**
   ```bash
   npm start
   ```
   Or, for development with auto-reload:
   ```bash
   npx ts-node index.ts
   ```

## API Endpoints

- **Create Event**
  - `POST /events/create`
  - Body: `{ "name": "Event Name", "seatsAvailable": 100 }`
  - Response: Created event object

- **Get Event**
  - `GET /events/:id`
  - Response: Event object or 404 if not found

## Notes
- Redis connection details are set in `docker-compose.yml` and used by the app.
- All code is in TypeScript. Main entry: `index.ts`.
- Event data is stored in Redis as hashes.

## Development
- Edit code in `routes/`, `controllers/`, `models/`, and `database/` directories.
- Use `.env` for custom environment variables if needed.

## License
MIT
