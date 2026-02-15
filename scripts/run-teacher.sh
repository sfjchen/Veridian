#!/usr/bin/env bash
# Start teacher backend in background, then frontend. Ctrl+C stops frontend; backend keeps running.
# To stop backend: pkill -f "teacher/backend/run.py" or kill the process shown at start.
# Run from repo root: ./scripts/run-teacher.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TEACHER_BACKEND="$REPO_ROOT/teacher/backend"
if [[ ! -d "$TEACHER_BACKEND/venv" ]] || [[ ! -f "$TEACHER_BACKEND/.env" ]]; then
  echo "Run ./scripts/setup-teacher.sh first."
  exit 1
fi

"$REPO_ROOT/scripts/kill-port.sh" 5001 || true
export SSL_CERT_FILE="$("$TEACHER_BACKEND/venv/bin/python" -c "import certifi; print(certifi.where())" 2>/dev/null)" || true
(cd "$TEACHER_BACKEND" && "$TEACHER_BACKEND/venv/bin/python" run.py) &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID (will stop on script exit)"
trap "kill $BACKEND_PID 2>/dev/null || true" EXIT

sleep 2
cd "$REPO_ROOT/teacher/frontend"
npx expo start
