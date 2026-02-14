#!/usr/bin/env bash
# One-time setup for the teacher app (backend + frontend).
# Run from repo root: ./scripts/setup-teacher.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "Setting up teacher app..."

if [[ ! -d backend/venv ]]; then
  echo "Creating backend venv..."
  python3 -m venv backend/venv
fi
echo "Installing backend dependencies..."
"$REPO_ROOT/backend/venv/bin/pip" install -r backend/requirements.txt --quiet

if [[ ! -f backend/.env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example backend/.env
    echo "Created backend/.env from .env.example — please fill in your keys."
  else
    echo "Missing backend/.env and .env.example. Create backend/.env with SUPABASE_*, ANTHROPIC_API_KEY, FLASK_SECRET_KEY, SUPABASE_JWT_SECRET."
    exit 1
  fi
fi

if [[ ! -d frontend/node_modules ]]; then
  echo "Installing frontend dependencies..."
  (cd frontend && npm install)
fi
if [[ ! -f frontend/.env ]]; then
  echo "Create frontend/.env with EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (see README)."
fi

echo "Teacher app setup done. Run backend: ./scripts/run-teacher-backend.sh"
echo "Run frontend (other terminal): ./scripts/run-teacher-frontend.sh"
