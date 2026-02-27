#!/usr/bin/env bash
# test.sh — Run all test suites.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILURES=0

run_test() {
  local name="$1"
  shift
  echo ""
  echo ">>> Running ${name} tests…"
  if "$@"; then
    echo "  ✓ ${name} tests passed"
  else
    echo "  ✗ ${name} tests FAILED"
    FAILURES=$((FAILURES + 1))
  fi
}

run_test "Frontend" bash -c "cd ${ROOT_DIR}/frontend && npm run test"

echo ""
if [[ ${FAILURES} -eq 0 ]]; then
  echo "✓ All tests passed."
else
  echo "✗ ${FAILURES} test suite(s) failed."
  exit 1
fi
