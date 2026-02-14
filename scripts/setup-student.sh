#!/usr/bin/env bash
# One-time setup for the student-platform app (Veridian).
# Run from repo root: ./scripts/setup-student.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STUDENT="$REPO_ROOT/student-platform"
cd "$STUDENT"

echo "Setting up student-platform..."

if [[ ! -d venv ]]; then
  echo "Creating venv..."
  python3 -m venv venv
fi
echo "Installing backend dependencies..."
"$STUDENT/venv/bin/pip" install -r requirements.txt --quiet

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    echo "Created .env from .env.example — please fill in API keys and Supabase vars."
  else
    echo "Missing .env and .env.example in student-platform."
    exit 1
  fi
fi

if [[ ! -d frontend/node_modules ]]; then
  echo "Installing frontend dependencies..."
  (cd frontend && npm install)
fi
if [[ ! -f frontend/.env ]]; then
  if [[ -f frontend/.env.example ]]; then
    cp frontend/.env.example frontend/.env
    echo "Created frontend/.env — set EXPO_PUBLIC_BACKEND_URL (e.g. http://localhost:8000)."
  fi
fi

echo "Student-platform setup done. Run backend: ./scripts/run-student-backend.sh"
echo "Run frontend (other terminal): ./scripts/run-student-frontend.sh"
