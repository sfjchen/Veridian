#!/usr/bin/env bash
# Start teacher Flask backend on http://localhost:5000
# Run from repo root: ./scripts/run-teacher-backend.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -d backend/venv ]]; then
  echo "Run ./scripts/setup-teacher.sh first."
  exit 1
fi
if [[ ! -f backend/.env ]]; then
  echo "Missing backend/.env. Run setup and add your keys."
  exit 1
fi

cd "$REPO_ROOT/backend" && "$REPO_ROOT/backend/venv/bin/python" run.py
