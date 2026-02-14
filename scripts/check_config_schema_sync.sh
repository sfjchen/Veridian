#!/usr/bin/env bash
# CI check: verify teacher and student config_schema.py stay in sync.
# The headers differ (teacher has a multi-line docstring, student has header
# comments + a one-line docstring), but all functional code must be identical.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

TEACHER="$REPO_ROOT/teacher/backend/app/services/config_schema.py"
STUDENT="$REPO_ROOT/student/backend/config_schema.py"

if [ ! -f "$TEACHER" ] || [ ! -r "$TEACHER" ]; then
  echo "FAIL: teacher config_schema.py not found or not readable at $TEACHER"
  exit 1
fi

if [ ! -f "$STUDENT" ] || [ ! -r "$STUDENT" ]; then
  echo "FAIL: student config_schema.py not found or not readable at $STUDENT"
  exit 1
fi

# Compare functional code only: everything from the first import line onward.
# This ignores header comments and docstring differences between the two copies.
TEACHER_CODE=$(sed -n '/^from typing/,$p' "$TEACHER")
STUDENT_CODE=$(sed -n '/^from typing/,$p' "$STUDENT")

if [ "$TEACHER_CODE" != "$STUDENT_CODE" ]; then
  echo "FAIL: config_schema.py functional code is out of sync."
  echo ""
  diff -u \
    <(echo "$TEACHER_CODE") \
    <(echo "$STUDENT_CODE") \
    --label "teacher/backend/app/services/config_schema.py" \
    --label "student/backend/config_schema.py" || true
  echo ""
  echo "Edit the canonical teacher copy, then replicate changes to the student copy."
  exit 1
fi

echo "OK: config_schema.py files are in sync."
