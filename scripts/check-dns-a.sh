#!/bin/bash
# Run DNS A-record check (BACKEND/scripts/check-dns-a.sh).
# Usage from repo root: ./scripts/check-dns-a.sh
#   EXPECTED_IP=1.2.3.4 ./scripts/check-dns-a.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
exec "${REPO_ROOT}/BACKEND/scripts/check-dns-a.sh" "$@"
