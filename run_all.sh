#!/usr/bin/env bash
# run_all.sh - Start backend and frontend concurrently
# Usage: ./run_all.sh [mode]
# mode: dev (default) or prod

set -e
MODE=${1:-dev}
# Set PYTHONPATH so that Backend config and modules are resolvable
export PYTHONPATH="$(pwd)/Backend:${PYTHONPATH:-}"  
# Activate virtualenv if present
if [ -f venv/bin/activate ]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi
# Determine python executable: prefer venv, fallback to python3
PYTHON_CMD="${VIRTUAL_ENV:+$VIRTUAL_ENV/bin/python3}"   # venv/bin/python3 if activated
PYTHON_CMD="${PYTHON_CMD:-python3}"                       # fallback to python3

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
  # Free up port 8000 if in use
  if command -v lsof >/dev/null 2>&1; then
    echo "⚙️  Clearing any process on port 8000..."
    lsof -ti tcp:8000 | xargs -r kill -9
  elif command -v fuser >/dev/null 2>&1; then
    echo "⚙️  Killing any process on port 8000 via fuser..."
    fuser -k 8000/tcp
  fi
  # Run backend in background from Backend folder
  (
    cd Backend
    echo "🚀 Uvicorn starting in Backend/"
    $PYTHON_CMD -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
  ) &
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
