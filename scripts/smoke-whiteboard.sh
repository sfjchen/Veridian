#!/usr/bin/env bash
# Smoke-check whiteboard deployment: frontend bundle env + optional backend /health.
set -euo pipefail

FRONTEND_URL="https://veridian-student.vercel.app"
BACKEND_URL=""
FAIL=0

say() { printf '%s\n' "$*"; }
fail() { say "FAIL: $*"; FAIL=1; }
pass() { say "OK: $*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --url) FRONTEND_URL="$2"; shift 2 ;;
    --backend) BACKEND_URL="$2"; shift 2 ;;
    *) FRONTEND_URL="$1"; shift ;;
  esac
done

say "=== Whiteboard smoke: $FRONTEND_URL ==="

code=$(curl -sS -o /dev/null -w '%{http_code}' "$FRONTEND_URL/" || echo "000")
if [ "$code" = "200" ]; then pass "frontend HTTP $code"; else fail "frontend HTTP $code"; fi

html=$(curl -sS "$FRONTEND_URL/" || true)
entry=$(printf '%s' "$html" | grep -oE 'entry-[a-f0-9]+\.js' | head -1 || true)
if [ -z "$entry" ]; then
  fail "could not find entry-*.js in HTML"
else
  bundle=$(curl -sS "$FRONTEND_URL/_expo/static/js/web/$entry" || true)
  if printf '%s' "$bundle" | grep -q 'daxwryjtzesdfjldvwsi'; then
    fail "bundle uses hackathon Supabase daxwryjtzesdfjldvwsi — update GHA vars/secrets and redeploy"
  else
    pass "bundle not on hackathon Supabase"
  fi
  if printf '%s' "$bundle" | grep -q 'veridian-fi00.onrender.com'; then
    fail "bundle uses stale backend veridian-fi00.onrender.com"
  else
    pass "bundle not on stale fi00 backend"
  fi
  if printf '%s' "$bundle" | grep -q 'tpqasmpieyteutvdntda'; then
    pass "bundle uses Jchen04 Supabase tpqasmpieyteutvdntda"
  else
    fail "bundle missing tpqasmpieyteutvdntda Supabase ref"
  fi
  baked_backend=$(printf '%s' "$bundle" | grep -oE 'https://[a-z0-9-]+\.onrender\.com' | head -1 || true)
  if [ -n "$baked_backend" ]; then
    pass "baked backend: $baked_backend"
    BACKEND_URL="${BACKEND_URL:-$baked_backend}"
  else
    fail "no onrender.com backend URL found in bundle"
  fi
fi

if [ -n "$BACKEND_URL" ]; then
  say "=== Backend: $BACKEND_URL ==="
  health_code=$(curl -sS -o /tmp/veridian-health.json -w '%{http_code}' "$BACKEND_URL/health" 2>/dev/null || echo "000")
  if [ "$health_code" = "200" ] && grep -q '"status"' /tmp/veridian-health.json 2>/dev/null; then
    pass "backend /health 200"
  else
    fail "backend /health $health_code (set Render secrets: ANTHROPIC_API_KEY, SUPABASE_*)"
  fi
fi

say "=== Done ==="
exit "$FAIL"
