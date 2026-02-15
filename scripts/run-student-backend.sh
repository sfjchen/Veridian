#!/usr/bin/env bash
# Start student Flask backend on http://localhost:8000
# Run from repo root: ./scripts/run-student-backend.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STUDENT_BACKEND="$REPO_ROOT/student/backend"

if [[ ! -d "$STUDENT_BACKEND/venv" ]]; then
  echo "Run ./scripts/setup-student.sh first."
  exit 1
fi
if [[ ! -f "$STUDENT_BACKEND/.env" ]]; then
  echo "Missing student/backend/.env. Run setup and add your keys."
  exit 1
fi

"$REPO_ROOT/scripts/kill-port.sh" 8000 || true
cd "$STUDENT_BACKEND" && "$STUDENT_BACKEND/venv/bin/python" get_coords.py
