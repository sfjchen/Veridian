#!/usr/bin/env bash
# Run lint and tests; if backends are running, check health. Exit non-zero if any step fails.
# Run from repo root: ./scripts/verify.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Lint ==="
echo "--- Teacher frontend lint ---"
(cd teacher/frontend && npm run lint)

echo "--- Student frontend lint ---"
(cd student/frontend && npm run lint)

echo "=== Tests ==="
echo "--- Teacher frontend tests ---"
(cd teacher/frontend && npm test -- --passWithNoTests)

STUDENT_BACKEND="$REPO_ROOT/student/backend"
if [[ -d "$STUDENT_BACKEND/venv" ]] && [[ -x "$STUDENT_BACKEND/venv/bin/pytest" ]]; then
  echo "--- Student backend pytest ---"
  (cd "$STUDENT_BACKEND" && ./venv/bin/pytest tests/ -q)
else
  echo "Skipping student backend pytest (no venv or pytest). Run ./scripts/setup-student.sh and pip install pytest if needed."
fi

echo "=== Health (optional; backends must be running) ==="
if curl -sf http://localhost:5001/health >/dev/null 2>&1; then
  echo "OK: Teacher backend health"
else
  echo "Skip: Teacher backend not reachable (start with ./scripts/run-teacher-backend.sh)"
fi
if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
  echo "OK: Student backend health"
else
  echo "Skip: Student backend not reachable (start with ./scripts/run-student-backend.sh)"
fi

echo "=== Verification done ==="
