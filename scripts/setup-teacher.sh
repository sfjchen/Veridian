#!/usr/bin/env bash
# One-time setup for the teacher app (backend + frontend).
# Run from repo root: ./scripts/setup-teacher.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TEACHER="$REPO_ROOT/teacher"
echo "Setting up teacher app..."

if [[ ! -d "$TEACHER/backend/venv" ]]; then
  echo "Creating backend venv..."
  python3 -m venv "$TEACHER/backend/venv"
fi
echo "Installing backend dependencies..."
"$TEACHER/backend/venv/bin/pip" install -r "$TEACHER/backend/requirements.txt" --quiet

if [[ ! -f "$TEACHER/backend/.env" ]]; then
  if [[ -f "$TEACHER/backend/.env.example" ]]; then
    cp "$TEACHER/backend/.env.example" "$TEACHER/backend/.env"
    echo "Created backend/.env from .env.example — please fill in your keys."
  else
    echo "Missing backend/.env and .env.example. Create teacher/backend/.env with SUPABASE_*, ANTHROPIC_API_KEY, FLASK_SECRET_KEY, SUPABASE_JWT_SECRET."
    exit 1
  fi
fi

if [[ ! -d "$TEACHER/frontend/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  (cd "$TEACHER/frontend" && npm install)
fi
if [[ ! -f "$TEACHER/frontend/.env" ]]; then
  if [[ -f "$TEACHER/frontend/.env.example" ]]; then
    cp "$TEACHER/frontend/.env.example" "$TEACHER/frontend/.env"
    echo "Created frontend/.env from .env.example — set EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY."
  else
    echo "Create teacher/frontend/.env with EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (see README)."
  fi
fi

echo "Teacher app setup done. Run backend: ./scripts/run-teacher-backend.sh"
echo "Run frontend (other terminal): ./scripts/run-teacher-frontend.sh"
