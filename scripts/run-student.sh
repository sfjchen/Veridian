#!/usr/bin/env bash
# Start student-platform backend in background, then frontend. Ctrl+C stops frontend; backend keeps running.
# Run from repo root: ./scripts/run-student.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STUDENT="$REPO_ROOT/student-platform"

if [[ ! -d "$STUDENT/venv" ]] || [[ ! -f "$STUDENT/.env" ]]; then
  echo "Run ./scripts/setup-student.sh first."
  exit 1
fi

(cd "$STUDENT" && "$STUDENT/venv/bin/python" get_coords.py) &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID (will stop on script exit)"
trap "kill $BACKEND_PID 2>/dev/null || true" EXIT

sleep 2
cd "$STUDENT/frontend"
npx expo start
