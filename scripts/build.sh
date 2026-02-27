#!/usr/bin/env bash
# build.sh — Build Docker images and push to the in-cluster registry.
# Delegates to the infrastructure script.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "${ROOT_DIR}/infrastructure/scripts/build-and-load.sh"
