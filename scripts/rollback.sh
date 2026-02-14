#!/usr/bin/env bash
# Rollback to previous working version. Checkouts commit and re-deploys.
# Usage: ./scripts/rollback.sh <staging|production> [commit-hash]
#   If commit not specified, uses .last-deploy-commit or latest in backups/
#   Re-runs full deploy for that commit.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENV="${1:-}"
COMMIT="${2:-}"

if [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
    echo -e "${RED}Usage: $0 <staging|production> [commit-hash]${NC}" >&2
    echo "  If commit omitted, uses .last-deploy-commit or backups/commit-*.txt" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Resolve commit
if [[ -z "$COMMIT" ]]; then
    if [[ -f "$REPO_ROOT/.last-deploy-commit" ]]; then
        COMMIT=$(cat "$REPO_ROOT/.last-deploy-commit")
        echo "Using commit from .last-deploy-commit: $COMMIT"
    elif ls "$REPO_ROOT/backups/commit-"*.txt 1>/dev/null 2>&1; then
        COMMIT=$(cat "$REPO_ROOT/backups/commit-"*.txt | tail -1)
        echo "Using commit from backups: $COMMIT"
    else
        echo -e "${RED}No previous commit found. Specify commit hash: $0 $ENV <commit>${NC}" >&2
        exit 1
    fi
fi

echo ""
echo "=== Rollback $ENV to $COMMIT ==="
echo ""

# Checkout
if ! git checkout "$COMMIT" 2>/dev/null; then
    echo -e "${RED}Failed to checkout $COMMIT${NC}" >&2
    exit 1
fi

echo -e "${GREEN}Checked out $COMMIT${NC}"
echo ""

# Re-deploy
if [[ "$ENV" == "staging" ]]; then
    exec "$REPO_ROOT/deploy.sh" staging --no-input --skip-pull
else
    # Production: don't pull (we already checked out specific commit)
    exec "$REPO_ROOT/deploy.sh" production --no-input --skip-pull
fi
