#!/usr/bin/env bash
# Deploy student Expo web app to Vercel (production). No local dev server.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$SCRIPT_DIR/../student/frontend"

cd "$FRONTEND"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Install Vercel CLI: npm i -g vercel@latest" >&2
  exit 1
fi

echo "=== Building Expo web export ==="
npx expo export -p web

echo "=== Deploying to Vercel (production) ==="
vercel deploy --prod

echo "Done. Set EXPO_PUBLIC_BACKEND_URL to your Render backend URL in Vercel project settings."
