#!/bin/bash
#
# FastPay – single entry point for staging and production deployment.
#
# Usage:
#   ./deploy.sh <staging|production> [target] [options]
#
# Environment (first argument):
#   staging    – Full staging deploy (dashboard + backend). Base path: current dir or /desktop/fastpay.
#   production – Full production deploy (dashboard + backend). Base path: /var/www/fastpay or PRODUCTION_BASE.
#
# Target (optional): all | dashboard | backend
#   all        – Deploy dashboard(s) + backend (default)
#   dashboard  – Build dashboards only (DASHBOARD_FASTPAY + DASHBOARD_REDPAY)
#   backend    – Deploy backend only
#
# Common options (both environments):
#   --no-input       Non-interactive (no prompts)
#   --pull           Sync from GitHub / git pull before deploy
#   --skip-pull      Use current tree only (staging default)
#   --skip-tests     Skip backend test suite
#   --skip-redpay    Skip RedPay dashboard build
#   --dry-run        Show what would be done
#
# Staging-only:
#   --skip-notify    Skip Telegram notifications
#   --apply-nginx    Apply host nginx on this machine so public URLs work (run on server)
#   --skip-apply-nginx  Do not try to apply host nginx
#   --require-public-urls  Exit with error if public URL checks fail
#
# Examples:
#   ./deploy.sh staging --no-input
#   ./deploy.sh production --no-input --pull
#   ./deploy.sh staging backend --no-input --skip-tests
#   ./deploy.sh production dashboard
#
# See: docs/DEPLOY_PROCESS.md and DEPLOYMENT.md
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENV_ARG=""
if [[ $# -gt 0 && ("$1" == "staging" || "$1" == "production") ]]; then
    ENV_ARG="$1"
    shift
fi

# --help
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "FastPay Deploy"
    echo ""
    echo "Usage: ./deploy.sh <staging|production> [target] [options]"
    echo ""
    echo "Target: all (default) | dashboard | backend"
    echo ""
    echo "Options:"
    echo "  --no-input       Non-interactive"
    echo "  --pull           Sync from GitHub before deploy"
    echo "  --skip-pull      Use current tree only"
    echo "  --skip-tests     Skip backend tests"
    echo "  --skip-redpay    Skip RedPay dashboard"
    echo "  --validate-only  Run preflight checks only, do not deploy"
    echo "  --skip-preflight Skip preflight checks"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh staging --no-input"
    echo "  ./deploy.sh production --no-input --pull"
    echo "  ./deploy.sh staging --validate-only"
    echo ""
    echo "Docs: docs/DEPLOY_PROCESS.md docs/EASY_SECURE_DEPLOY_PLAN.md"
    exit 0
fi

# --validate-only
if [[ "$1" == "--validate-only" ]]; then
    shift
    if [[ -z "$ENV_ARG" ]]; then
        echo -e "${RED}Usage: ./deploy.sh <staging|production> --validate-only${NC}" >&2
        exit 1
    fi
    if [[ -x "$SCRIPT_DIR/scripts/preflight-check.sh" ]]; then
        exec "$SCRIPT_DIR/scripts/preflight-check.sh" "$ENV_ARG"
    else
        echo -e "${RED}preflight-check.sh not found${NC}" >&2
        exit 1
    fi
fi

if [[ -z "$ENV_ARG" ]]; then
    echo -e "${RED}Usage: ./deploy.sh <staging|production> [target] [options]${NC}" >&2
    echo "" >&2
    echo "Environments:" >&2
    echo "  staging    – Deploy to staging (deploy-all.sh)" >&2
    echo "  production – Deploy to production (deploy-production.sh)" >&2
    echo "" >&2
    echo "Target (optional): all (default) | dashboard | backend" >&2
    echo "Options: --no-input, --pull, --skip-pull, --skip-tests, --skip-redpay, --dry-run" >&2
    echo "Staging only: --skip-notify" >&2
    echo "" >&2
    echo "Docs: docs/DEPLOY_PROCESS.md  DEPLOYMENT.md" >&2
    exit 1
fi

if [[ "$ENV_ARG" == "staging" ]]; then
    if [[ ! -x "$SCRIPT_DIR/deploy-all.sh" ]]; then
        echo -e "${RED}deploy-all.sh not found or not executable${NC}" >&2
        exit 1
    fi
    exec "$SCRIPT_DIR/deploy-all.sh" "$@"
fi

if [[ "$ENV_ARG" == "production" ]]; then
    if [[ ! -x "$SCRIPT_DIR/deploy-production.sh" ]]; then
        echo -e "${RED}deploy-production.sh not found or not executable${NC}" >&2
        exit 1
    fi
    exec "$SCRIPT_DIR/deploy-production.sh" "$@"
fi

echo -e "${RED}Unknown environment: $ENV_ARG${NC}" >&2
exit 1
