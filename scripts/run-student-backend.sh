#!/usr/bin/env bash
# Start student-platform Flask backend on http://localhost:8000
# Run from repo root: ./scripts/run-student-backend.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STUDENT="$REPO_ROOT/student-platform"

if [[ ! -d "$STUDENT/venv" ]]; then
  echo "Run ./scripts/setup-student.sh first."
  exit 1
fi
if [[ ! -f "$STUDENT/.env" ]]; then
  echo "Missing student-platform/.env. Run setup and add your keys."
  exit 1
fi

cd "$STUDENT" && "$STUDENT/venv/bin/python" get_coords.py
