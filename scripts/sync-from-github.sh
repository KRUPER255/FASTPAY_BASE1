#!/bin/bash
#
# FastPay GitHub sync – clone or update repo for staging/production deploy.
# Use this before running deploy steps so the tree at the environment base path is up to date.
#
# Usage:
#   ./scripts/sync-from-github.sh [staging|production] [options]
#   REPO_BASE=/var/www/fastpay ./scripts/sync-from-github.sh production
#
# Options:
#   --branch <name>   Branch to checkout (default: main for staging, main for production)
#   --tag <tag>       Deploy a specific release tag (detached HEAD)
#   --commit <sha>    Deploy a specific commit (detached HEAD)
#   --skip-pull       Do not pull; only fetch and checkout ref (e.g. after clone)
#   --clone-only      Only clone if directory missing; do not pull
#
# Environment:
#   REPO_BASE or FASTPAY_DEPLOY_BASE  Override base path (default: /desktop/fastpay for staging, /var/www/fastpay for production)
#   GITHUB_REPO_URL                    Clone URL (default: origin URL of repo containing this script, or placeholder)
#   GITHUB_STAGING_BRANCH              Default branch for staging (default: main)
#   GITHUB_PRODUCTION_BRANCH           Default branch for production (default: main)
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENV_NAME=""
BRANCH=""
TAG=""
COMMIT=""
SKIP_PULL=false
CLONE_ONLY=false

# Parse first arg: staging | production
if [[ $# -gt 0 && "$1" == "staging" ]]; then
    ENV_NAME=staging
    shift
elif [[ $# -gt 0 && "$1" == "production" ]]; then
    ENV_NAME=production
    shift
else
    echo -e "${RED}Usage: $0 [staging|production] [--branch NAME] [--tag TAG] [--commit SHA] [--skip-pull] [--clone-only]${NC}" >&2
    echo "  staging    -> base path /desktop/fastpay" >&2
    echo "  production -> base path /var/www/fastpay" >&2
    exit 1
fi

# Parse options
while [[ $# -gt 0 ]]; do
    case "$1" in
        --branch)   BRANCH="$2";   shift 2 ;;
        --tag)      TAG="$2";     shift 2 ;;
        --commit)   COMMIT="$2";  shift 2 ;;
        --skip-pull) SKIP_PULL=true; shift ;;
        --clone-only) CLONE_ONLY=true; shift ;;
        *) echo -e "${RED}Unknown option: $1${NC}" >&2; exit 1 ;;
    esac
done

# Resolve base path
if [[ -n "$REPO_BASE" ]]; then
    BASE_PATH="$REPO_BASE"
elif [[ -n "$FASTPAY_DEPLOY_BASE" ]]; then
    BASE_PATH="$FASTPAY_DEPLOY_BASE"
elif [[ "$ENV_NAME" == "staging" ]]; then
    BASE_PATH="/desktop/fastpay"
elif [[ "$ENV_NAME" == "production" ]]; then
    BASE_PATH="/var/www/fastpay"
else
    echo -e "${RED}Invalid environment: $ENV_NAME${NC}" >&2
    exit 1
fi

# Default branch per environment (only if no --tag or --commit)
if [[ -z "$TAG" && -z "$COMMIT" ]]; then
    if [[ -z "$BRANCH" ]]; then
        if [[ "$ENV_NAME" == "staging" && -n "$GITHUB_STAGING_BRANCH" ]]; then
            BRANCH="$GITHUB_STAGING_BRANCH"
        elif [[ "$ENV_NAME" == "production" && -n "$GITHUB_PRODUCTION_BRANCH" ]]; then
            BRANCH="$GITHUB_PRODUCTION_BRANCH"
        else
            BRANCH="main"
        fi
    fi
fi

# Repo URL: from env, or from origin if we're inside a git repo
if [[ -n "$GITHUB_REPO_URL" ]]; then
    REPO_URL="$GITHUB_REPO_URL"
elif [[ -d "$REPO_ROOT/.git" ]]; then
    REPO_URL="$(git -C "$REPO_ROOT" config --get remote.origin.url 2>/dev/null || true)"
fi
if [[ -z "$REPO_URL" ]]; then
    echo -e "${RED}GITHUB_REPO_URL not set and could not get origin URL from $REPO_ROOT. Set GITHUB_REPO_URL to the clone URL.${NC}" >&2
    exit 1
fi

echo "========================================="
echo "FastPay GitHub sync: $ENV_NAME"
echo "Base path: $BASE_PATH"
echo "Repo URL:  $REPO_URL"
[[ -n "$BRANCH" ]] && echo "Branch:    $BRANCH"
[[ -n "$TAG" ]]    && echo "Tag:       $TAG"
[[ -n "$COMMIT" ]] && echo "Commit:    $COMMIT"
echo "========================================="

# Clone if missing
if [[ ! -d "$BASE_PATH" ]]; then
    if [[ "$CLONE_ONLY" == "true" ]]; then
        echo -e "${YELLOW}Base path $BASE_PATH does not exist and --clone-only set. Creating directory and cloning.${NC}"
    fi
    echo -e "${GREEN}Cloning repository into $BASE_PATH...${NC}"
    mkdir -p "$(dirname "$BASE_PATH")"
    if [[ "$(dirname "$BASE_PATH")" != "/" ]]; then
        sudo mkdir -p "$(dirname "$BASE_PATH")" 2>/dev/null || true
    fi
    # Prefer clone as current user; if base is under /var/www or /desktop may need sudo
    if git clone --branch "${BRANCH:-main}" "$REPO_URL" "$BASE_PATH" 2>/dev/null; then
        echo -e "${GREEN}Cloned successfully.${NC}"
        exit 0
    fi
    # Try with sudo for system paths
    if sudo bash -c "git clone --branch ${BRANCH:-main} $REPO_URL $BASE_PATH"; then
        echo -e "${GREEN}Cloned successfully (with sudo).${NC}"
        exit 0
    fi
    echo -e "${RED}Clone failed. Check permissions and REPO_URL.${NC}" >&2
    exit 1
fi

# Directory exists – fetch and checkout
if [[ ! -d "$BASE_PATH/.git" ]]; then
    echo -e "${RED}$BASE_PATH exists but is not a git repository. Remove it or use a different path.${NC}" >&2
    exit 1
fi

cd "$BASE_PATH"
echo -e "${GREEN}Fetching from origin...${NC}"
git fetch origin || { echo -e "${RED}git fetch failed${NC}" >&2; exit 1; }

if [[ -n "$COMMIT" ]]; then
    echo -e "${GREEN}Checking out commit $COMMIT...${NC}"
    git checkout "$COMMIT" || { echo -e "${RED}git checkout $COMMIT failed${NC}" >&2; exit 1; }
elif [[ -n "$TAG" ]]; then
    echo -e "${GREEN}Checking out tag $TAG...${NC}"
    git checkout "tags/$TAG" 2>/dev/null || git checkout "$TAG" || { echo -e "${RED}git checkout $TAG failed${NC}" >&2; exit 1; }
else
    echo -e "${GREEN}Checking out branch $BRANCH...${NC}"
    git checkout "$BRANCH" || { echo -e "${RED}git checkout $BRANCH failed${NC}" >&2; exit 1; }
    if [[ "$SKIP_PULL" != "true" && "$CLONE_ONLY" != "true" ]]; then
        echo -e "${GREEN}Pulling latest...${NC}"
        git pull origin "$BRANCH" || { echo -e "${RED}git pull failed${NC}" >&2; exit 1; }
    fi
fi

echo -e "${GREEN}Sync complete. HEAD at: $(git rev-parse --short HEAD)${NC}"
exit 0
