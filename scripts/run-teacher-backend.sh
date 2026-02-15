#!/usr/bin/env bash
# Start teacher Flask backend on http://localhost:5001
# Run from repo root: ./scripts/run-teacher-backend.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TEACHER_BACKEND="$REPO_ROOT/teacher/backend"
if [[ ! -d "$TEACHER_BACKEND/venv" ]]; then
  echo "Run ./scripts/setup-teacher.sh first."
  exit 1
fi
if [[ ! -f "$TEACHER_BACKEND/.env" ]]; then
  echo "Missing teacher/backend/.env. Run setup and add your keys."
  exit 1
fi

"$REPO_ROOT/scripts/kill-port.sh" 5001 || true
export SSL_CERT_FILE="$("$TEACHER_BACKEND/venv/bin/python" -c "import certifi; print(certifi.where())" 2>/dev/null)" || true
cd "$TEACHER_BACKEND" && "$TEACHER_BACKEND/venv/bin/python" run.py
