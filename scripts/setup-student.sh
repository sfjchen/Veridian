#!/usr/bin/env bash
# One-time setup for the student app (Veridian).
# Run from repo root: ./scripts/setup-student.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STUDENT_BACKEND="$REPO_ROOT/student/backend"
STUDENT_FRONTEND="$REPO_ROOT/student/frontend"

echo "Setting up student app..."

cd "$STUDENT_BACKEND"
if [[ ! -d venv ]]; then
  echo "Creating venv..."
  python3 -m venv venv
fi
echo "Installing backend dependencies..."
"$STUDENT_BACKEND/venv/bin/pip" install -r requirements.txt --quiet

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    echo "Created .env from .env.example — please fill in API keys and Supabase vars."
  else
    echo "Missing .env and .env.example in student/backend."
    exit 1
  fi
fi

cd "$STUDENT_FRONTEND"
if [[ ! -d node_modules ]]; then
  echo "Installing frontend dependencies..."
  npm install
fi
if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    echo "Created frontend/.env — set EXPO_PUBLIC_BACKEND_URL (e.g. http://localhost:8000)."
  fi
fi

echo "Student setup done. Run backend: ./scripts/run-student-backend.sh"
echo "Run frontend (other terminal): ./scripts/run-student-frontend.sh"
