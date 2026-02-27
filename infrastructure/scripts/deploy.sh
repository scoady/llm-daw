#!/usr/bin/env bash
# deploy.sh — First-time Helm install for LLM-DAW.
#
# Prerequisites:
#   1. A running k8s cluster with an in-cluster Docker registry
#   2. Images already pushed (via build-and-load.sh or Jenkins)
#
# This script does:
#   1. helm upgrade --install with the current image tag
#   2. Verifies rollout status
#   3. Polls /api/health until the API is reachable
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CHART_DIR="${ROOT_DIR}/infrastructure/helm/llm-daw"
VALUES_FILE="${CHART_DIR}/values.yaml"
REGISTRY="${REGISTRY:-registry.registry.svc.cluster.local:5000}"

# ── Image tag ─────────────────────────────────────────────────────────────────
TAG="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)"
if [[ -n "$(git -C "${ROOT_DIR}" status --porcelain 2>/dev/null)" ]]; then
  TAG="${TAG}-dev"
fi
echo ">>> Deploying LLM-DAW (tag=${TAG}, registry=${REGISTRY})…"

# ── Helm install ──────────────────────────────────────────────────────────────
helm upgrade --install llm-daw "${CHART_DIR}" \
  --namespace llm-daw \
  --create-namespace \
  --values "${VALUES_FILE}" \
  --set "global.imageRegistry=${REGISTRY}" \
  --set "frontend.image.tag=${TAG}" \
  --set "frontend.image.pullPolicy=Always" \
  --set "api.image.tag=${TAG}" \
  --set "api.image.pullPolicy=Always" \
  --wait \
  --timeout 5m

# ── Verify rollout ────────────────────────────────────────────────────────────
echo ""
echo ">>> Verifying rollout…"
kubectl rollout status deployment/frontend -n llm-daw --timeout=120s
kubectl rollout status deployment/api       -n llm-daw --timeout=120s

# ── Health check ──────────────────────────────────────────────────────────────
echo ""
echo ">>> Waiting for API to become healthy…"
for i in $(seq 1 30); do
  if curl -sf http://localhost/api/health >/dev/null 2>&1; then
    echo "✓ API is healthy."
    break
  fi
  echo "  Attempt ${i}/30 — waiting…"
  sleep 2
done

echo ""
echo "✓ LLM-DAW deployed."
echo "  Pods:"
kubectl get pods -n llm-daw
