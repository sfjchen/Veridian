#!/usr/bin/env bash
# Smoke-check whiteboard: canonical Next.js (sfjc.dev/veridian) or legacy Expo bundle.
set -euo pipefail

FRONTEND_URL="https://sfjc.dev/veridian"
BACKEND_URL=""
SKIP_BACKEND=0
BACKEND_ONLY=0
LEGACY_EXPO=0
FAIL=0

say() { printf '%s\n' "$*"; }
fail() { say "FAIL: $*"; FAIL=1; }
pass() { say "OK: $*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --url) FRONTEND_URL="$2"; shift 2 ;;
    --backend) BACKEND_URL="$2"; shift 2 ;;
    --skip-backend) SKIP_BACKEND=1; shift ;;
    --backend-only) BACKEND_ONLY=1; shift ;;
    --legacy-expo) LEGACY_EXPO=1; shift ;;
    *) FRONTEND_URL="$1"; shift ;;
  esac
done

if [ "$BACKEND_ONLY" = "1" ]; then
  BACKEND_URL="${BACKEND_URL:-https://veridian-student-backend-kz5l.onrender.com}"
  say "=== Backend only: $BACKEND_URL ==="
  health_code=$(curl -sS -o /tmp/veridian-health.json -w '%{http_code}' "$BACKEND_URL/health" 2>/dev/null || echo "000")
  if [ "$health_code" = "200" ] && grep -q '"status"' /tmp/veridian-health.json 2>/dev/null; then
    pass "backend /health 200"
  else
    fail "backend /health $health_code (Render secrets / start command)"
  fi
  say "=== Done ==="
  exit "$FAIL"
fi

# Default: canonical Next.js unless URL looks like legacy Expo host
if [ "$LEGACY_EXPO" = "0" ] && printf '%s' "$FRONTEND_URL" | grep -qE 'veridian-student\.vercel\.app|veridian\.fyi'; then
  LEGACY_EXPO=1
fi

say "=== Whiteboard smoke: $FRONTEND_URL ($([ "$LEGACY_EXPO" = "1" ] && echo legacy-expo || echo canonical)) ==="

code=$(curl -sSL -o /dev/null -w '%{http_code}' "$FRONTEND_URL" || echo "000")
if [ "$code" = "200" ]; then pass "frontend HTTP $code"; else fail "frontend HTTP $code"; fi

html=$(curl -sSL "$FRONTEND_URL" || true)

if [ "$LEGACY_EXPO" = "0" ]; then
  if printf '%s' "$html" | grep -qE 'veridianApp|AI math whiteboard|<title>Veridian'; then
    pass "canonical Next.js whiteboard page"
  else
    fail "expected Veridian whiteboard markers in HTML"
  fi
  health_code=$(curl -sS -o /tmp/veridian-api-health.json -w '%{http_code}' "${FRONTEND_URL%/}/api/health" 2>/dev/null || echo "000")
  if [ "$health_code" = "200" ]; then
    pass "canonical /api/health 200"
  else
    fail "canonical /api/health $health_code"
  fi
else
  entry=$(printf '%s' "$html" | grep -oE 'entry-[a-f0-9]+\.js' | head -1 || true)
  if [ -z "$entry" ]; then
    fail "could not find entry-*.js in HTML (legacy Expo)"
  else
    bundle_file=$(mktemp)
    curl -sS "$FRONTEND_URL/_expo/static/js/web/$entry" -o "$bundle_file" || true
    if grep -q 'daxwryjtzesdfjldvwsi' "$bundle_file" 2>/dev/null; then
      fail "bundle uses hackathon Supabase daxwryjtzesdfjldvwsi"
    else
      pass "bundle not on hackathon Supabase"
    fi
    if grep -q 'veridian-fi00.onrender.com' "$bundle_file" 2>/dev/null; then
      fail "bundle uses stale backend veridian-fi00"
    else
      pass "bundle not on stale fi00 backend"
    fi
    baked_backend=$(grep -oE 'https://[a-z0-9-]+\.onrender\.com' "$bundle_file" 2>/dev/null | head -1 || true)
    rm -f "$bundle_file"
    if [ -n "$baked_backend" ]; then
      pass "baked backend: $baked_backend"
      BACKEND_URL="${BACKEND_URL:-$baked_backend}"
    else
      fail "no onrender.com backend URL in legacy bundle"
    fi
  fi
fi

if [ "$SKIP_BACKEND" = "0" ] && [ -n "$BACKEND_URL" ]; then
  say "=== Backend: $BACKEND_URL ==="
  health_code=$(curl -sS -o /tmp/veridian-health.json -w '%{http_code}' "$BACKEND_URL/health" 2>/dev/null || echo "000")
  if [ "$health_code" = "200" ] && grep -q '"status"' /tmp/veridian-health.json 2>/dev/null; then
    pass "backend /health 200"
  else
    fail "backend /health $health_code"
  fi
fi

say "=== Done ==="
exit "$FAIL"
