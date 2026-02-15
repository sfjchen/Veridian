#!/usr/bin/env bash
# Start student backend in background, then frontend. Ctrl+C stops frontend; backend keeps running.
# Run from repo root: ./scripts/run-student.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STUDENT_BACKEND="$REPO_ROOT/student/backend"

if [[ ! -d "$STUDENT_BACKEND/venv" ]]; then
  echo "Run ./scripts/setup-student.sh first."
  exit 1
fi
if [[ ! -f "$STUDENT_BACKEND/.env" ]] && [[ ! -f "$REPO_ROOT/environment/.env" ]]; then
  echo "Add a .env with ANTHROPIC_API_KEY and CLAUDE_MODEL in student/backend/ or environment/."
  exit 1
fi

"$REPO_ROOT/scripts/kill-port.sh" 8000 || true
(cd "$STUDENT_BACKEND" && "$STUDENT_BACKEND/venv/bin/python" get_coords.py) &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID (will stop on script exit)"
trap "kill $BACKEND_PID 2>/dev/null || true" EXIT

sleep 2
cd "$REPO_ROOT/student/frontend"
npx expo start
