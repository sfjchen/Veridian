#!/usr/bin/env bash
# Start teacher backend in background, then frontend. Ctrl+C stops frontend; backend keeps running.
# To stop backend: pkill -f "python backend/run.py" or kill the process shown at start.
# Run from repo root: ./scripts/run-teacher.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -d backend/venv ]] || [[ ! -f backend/.env ]]; then
  echo "Run ./scripts/setup-teacher.sh first."
  exit 1
fi

(cd "$REPO_ROOT/backend" && "$REPO_ROOT/backend/venv/bin/python" run.py) &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID (will stop on script exit)"
trap "kill $BACKEND_PID 2>/dev/null || true" EXIT

sleep 2
cd "$REPO_ROOT/frontend"
npx expo start
