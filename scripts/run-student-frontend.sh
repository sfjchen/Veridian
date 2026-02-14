#!/usr/bin/env bash
# Start student-platform Expo frontend. Backend should be running on port 8000.
# Run from repo root: ./scripts/run-student-frontend.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/student-platform/frontend"

if [[ ! -d node_modules ]]; then
  echo "Run ./scripts/setup-student.sh first."
  exit 1
fi

npx expo start
