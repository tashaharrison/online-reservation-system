# Online Reservation System

Online reservation system API for creating and managing seat reservation at events.

## Prerequisites
- Docker & Docker Compose

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

## Documentation

- [Design Document](./docs/design-document.md)
- [OpenAPI Schema](./docs/openapi.yaml)

## License
MIT
