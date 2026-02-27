#!/usr/bin/env bash
# deploy.sh — Deploy to Kubernetes via Helm.
# Delegates to the infrastructure script.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "${ROOT_DIR}/infrastructure/scripts/deploy.sh"
