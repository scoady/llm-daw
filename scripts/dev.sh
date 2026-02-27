#!/usr/bin/env bash
# dev.sh — Start frontend + API dev servers locally.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Install deps if needed ────────────────────────────────────────────────────
if [[ ! -d "${ROOT_DIR}/frontend/node_modules" ]]; then
  echo ">>> Installing frontend dependencies…"
  (cd "${ROOT_DIR}/frontend" && npm install)
fi

if [[ ! -d "${ROOT_DIR}/backend/api/node_modules" ]]; then
  echo ">>> Installing API dependencies…"
  (cd "${ROOT_DIR}/backend/api" && npm install)
fi

# ── Start services ────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo ">>> Shutting down dev servers…"
  kill 0 2>/dev/null
}
trap cleanup EXIT

echo ""
echo ">>> Starting dev servers…"
echo "    Frontend:  http://localhost:5173"
echo "    API:       http://localhost:4000"
echo ""

(cd "${ROOT_DIR}/frontend"    && npm run dev) &
(cd "${ROOT_DIR}/backend/api" && npm run dev) &

wait
