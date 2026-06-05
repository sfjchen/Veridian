#!/usr/bin/env bash
# Deploy student Expo web app to Vercel (production). No local dev server.
# Run from repo root — Vercel project rootDirectory is student/frontend.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND="$REPO_ROOT/student/frontend"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Install Vercel CLI: npm i -g vercel@latest" >&2
  exit 1
fi

# Ensure .vercel link at repo root (Vercel dashboard rootDirectory = student/frontend)
if [ ! -f "$REPO_ROOT/.vercel/project.json" ] && [ -f "$FRONTEND/.vercel/project.json" ]; then
  mkdir -p "$REPO_ROOT/.vercel"
  cp "$FRONTEND/.vercel/project.json" "$REPO_ROOT/.vercel/project.json"
fi

cd "$REPO_ROOT"
echo "=== Deploying to Vercel (production) from repo root ==="
vercel deploy --prod

echo "Done. Ensure EXPO_PUBLIC_BACKEND_URL points to your Render backend in Vercel env."
