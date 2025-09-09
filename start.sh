#!/bin/sh

echo "🚀 Starting Fabacus Online Reservation System..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the queue worker in the background with logging
echo "📋 Starting queue worker..."
node dist/src/worker.js > logs/worker.log 2>&1 &
WORKER_PID=$!

# Start the main server with logging
echo "🌐 Starting main server..."
node dist/src/index.js > logs/server.log 2>&1 &
SERVER_PID=$!

# Function to handle shutdown
cleanup() {
    echo "⏹️  Shutting down services..."
    kill $WORKER_PID 2>/dev/null
    kill $SERVER_PID 2>/dev/null
    wait $WORKER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
    echo "✅ Services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

echo "✅ Both services started successfully"
echo "   - Queue Worker PID: $WORKER_PID (logs: logs/worker.log)"
echo "   - Main Server PID: $SERVER_PID (logs: logs/server.log)"
echo ""
echo "Use Ctrl+C to stop all services"
echo "Monitor logs with: tail -f logs/server.log logs/worker.log"

# Wait for both processes
wait $SERVER_PID
wait $WORKER_PID
