#!/usr/bin/env bash
# Start teacher Expo frontend. Backend should be running on port 5001.
# Run from repo root: ./scripts/run-teacher-frontend.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/teacher/frontend"

if [[ ! -d node_modules ]]; then
  echo "Run ./scripts/setup-teacher.sh first."
  exit 1
fi

npx expo start
