#!/usr/bin/env bash
# run_all.sh - Start backend and frontend concurrently
# Usage: ./run_all.sh [mode]
# mode: dev (default) or prod

set -e
MODE=${1:-dev}
export PYTHONPATH="$(pwd)"

# Test mode: run backend and frontend tests concurrently
if [ "$MODE" = "test" ]; then
  echo "🧪 Running backend tests..."
  pytest -q &
  BACKEND_TEST_PID=$!

  echo "🧪 Running frontend tests..."
  cd Frontend
  npm install --legacy-peer-deps --force
  npm test &
  FRONTEND_TEST_PID=$!
  cd - >/dev/null

  # Wait for both test processes to finish
  wait $BACKEND_TEST_PID $FRONTEND_TEST_PID
  exit 0
fi

# Start backend
echo "🚀 Starting backend (FastAPI) on http://localhost:8000..."
# Run backend in background
uvicorn Backend.main:app --reload --port 8000 &
BACKEND_PID=$!

  if [ "$MODE" = "dev" ]; then
  # Start frontend in dev mode
  echo "🚀 Starting frontend (Vite) in dev mode on http://localhost:5173..."
  cd Frontend
  npm install --legacy-peer-deps --force
  npm run dev &
  FRONTEND_PID=$!
  cd - >/dev/null
else
  # Production mode: build frontend then serve from static server
  echo "🔨 Building frontend..."
  cd Frontend
  npm install --legacy-peer-deps --force
  npm run build
  echo "🚀 Serving built frontend on http://localhost:4173..."
  npm run serve &
  FRONTEND_PID=$!
  cd - >/dev/null
fi

# Wait for both
wait $BACKEND_PID $FRONTEND_PID
