#!/usr/bin/env bash
# build-and-load.sh — Build images and push to the in-cluster registry,
#                     then upgrade the Helm release.
#
# This is the local-dev equivalent of what Jenkins does with Kaniko.
# Images are built with Docker, pushed to the in-cluster registry, and
# Helm is upgraded with the new tag.
#
# Requires:
#   - Docker CLI
#   - The in-cluster registry accessible at localhost:5000
#     (port-forwarded or exposed via NodePort)
#   - helm & kubectl configured for the target cluster
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CHART_DIR="${ROOT_DIR}/infrastructure/helm/llm-daw"
VALUES_FILE="${CHART_DIR}/values.yaml"
REGISTRY="${REGISTRY:-localhost:5000}"

# ── Image tag ─────────────────────────────────────────────────────────────────
# Use the short git SHA as the tag. Append -dev if there are uncommitted changes
# so each local iteration gets a unique tag even before committing.
TAG="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)"
if [[ -n "$(git -C "${ROOT_DIR}" status --porcelain 2>/dev/null)" ]]; then
  TAG="${TAG}-dev"
fi
echo ">>> Image tag: ${TAG}"
echo ">>> Registry:  ${REGISTRY}"

# ── 1. Build images ───────────────────────────────────────────────────────────
echo ""
echo ">>> Building Docker images…"

echo "  [1/2] ${REGISTRY}/llm-daw/frontend:${TAG}"
docker build -t "${REGISTRY}/llm-daw/frontend:${TAG}" \
             -t "${REGISTRY}/llm-daw/frontend:latest" \
             "${ROOT_DIR}/frontend"

echo "  [2/2] ${REGISTRY}/llm-daw/api:${TAG}"
docker build -t "${REGISTRY}/llm-daw/api:${TAG}" \
             -t "${REGISTRY}/llm-daw/api:latest" \
             "${ROOT_DIR}/backend/api"

# ── 2. Push to in-cluster registry ────────────────────────────────────────────
echo ""
echo ">>> Pushing images to ${REGISTRY}…"
docker push "${REGISTRY}/llm-daw/frontend:${TAG}"
docker push "${REGISTRY}/llm-daw/frontend:latest"
docker push "${REGISTRY}/llm-daw/api:${TAG}"
docker push "${REGISTRY}/llm-daw/api:latest"

# ── 3. Helm upgrade ──────────────────────────────────────────────────────────
if kubectl get namespace llm-daw &>/dev/null; then
  echo ""
  echo ">>> Upgrading Helm release (tag=${TAG})…"
  helm upgrade llm-daw "${CHART_DIR}" \
    --namespace llm-daw \
    --values "${VALUES_FILE}" \
    --set "global.imageRegistry=${REGISTRY}" \
    --set "frontend.image.tag=${TAG}" \
    --set "frontend.image.pullPolicy=Always" \
    --set "api.image.tag=${TAG}" \
    --set "api.image.pullPolicy=Always" \
    --wait \
    --timeout 3m

  echo ""
  echo "✓ Update complete. Open http://localhost in your browser."
else
  echo ""
  echo "✓ Images pushed."
  echo "  Namespace 'llm-daw' not found — run deploy.sh for a first-time deploy."
fi
