#!/bin/bash

# FastPay Dashboard Management Agent
# Dedicated tool for dashboard development and deployment

set -e

# Auto-detect directory (script location)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_DIR="$SCRIPT_DIR"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../BACKEND" && pwd)"
cd "$DASHBOARD_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print header
print_header() {
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║   FastPay Dashboard Management Agent  ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    echo ""
}

# Print status
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_step() {
    echo -e "${BLUE}→${NC} $1"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed!"
        echo "Install Node.js first: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
        exit 1
    fi
    print_success "Node.js $(node --version) found"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed!"
        exit 1
    fi
    print_success "npm $(npm --version) found"
}

# Install dependencies
install_deps() {
    print_header
    print_step "Installing dependencies..."
    
    check_node
    check_npm
    
    npm install
    
    print_success "Dependencies installed!"
}

# Development server
dev_server() {
    print_header
    print_step "Starting development server..."
    
    check_node
    check_npm
    
    if [ ! -d "node_modules" ]; then
        print_info "Dependencies not found, installing..."
        npm install
    fi
    
    print_info "Development server will start on http://localhost:5173"
    print_info "Press Ctrl+C to stop"
    echo ""
    
    npm run dev
}

# Build for production (root path: /)
build_production() {
    print_header
    print_step "Building dashboard for production (72.60.202.91/)..."
    
    check_node
    check_npm
    
    # Check for .env.production
    if [ ! -f ".env.production" ]; then
        print_info "Creating .env.production..."
        if [ -f ".env.local" ]; then
            cp .env.local .env.production
            print_info "Created .env.production from .env.local"
            print_info "Update .env.production with production values if needed"
        elif [ -f ".env.example" ]; then
            cp .env.example .env.production
            print_info "Created .env.production from .env.example"
            print_info "Update .env.production with production values"
        else
            print_warning ".env.production not found and no template available"
            print_info "Build will continue, but you may need to set environment variables"
        fi
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        npm install
    fi
    
    # Build with production base path
    print_step "Building for production (base: /)..."
    export VITE_BASE_PATH=/
    npm run build
    
    if [ -d "dist" ]; then
        print_success "Build complete! Files in dist/"
        echo ""
        print_info "Build size:"
        du -sh dist/
        echo ""
        print_info "Files:"
        ls -lh dist/ | head -10
        echo ""
        print_info "Deploy to: http://72.60.202.91/"
    else
        print_error "Build failed! dist/ directory not found"
        exit 1
    fi
}

# Build for test/local (subdirectory path: /test/)
build_test() {
    print_header
    print_step "Building dashboard for test/local (72.60.202.91/test/)..."
    
    check_node
    check_npm
    
    # Check for .env.local (optional for test builds)
    if [ ! -f ".env.local" ]; then
        if [ -f ".env.example" ]; then
            print_info "Creating .env.local from .env.example..."
            cp .env.example .env.local
            print_info "Created .env.local (update with test values if needed)"
        else
            print_warning ".env.local not found and .env.example not available"
            print_info "Build will continue, but you may need to set environment variables"
        fi
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        npm install
    fi
    
    # Build with test base path
    print_step "Building for test (base: /test/)..."
    export VITE_BASE_PATH=/test/
    npm run build
    
    if [ -d "dist" ]; then
        print_success "Build complete! Files in dist/"
        echo ""
        print_info "Build size:"
        du -sh dist/
        echo ""
        print_info "Files:"
        ls -lh dist/ | head -10
        echo ""
        print_info "Deploy to: http://72.60.202.91/test/"
    else
        print_error "Build failed! dist/ directory not found"
        exit 1
    fi
}

# Deploy to production
deploy() {
    local env=${1:-production}
    
    print_header
    
    if [ "$env" = "test" ] || [ "$env" = "local" ]; then
        print_step "Deploying dashboard to test/local (72.60.202.91/test/)..."
        build_test
        print_info "Deploy dist/ contents to: /var/www/html/test/ or equivalent"
    else
        print_step "Deploying dashboard to production (72.60.202.91/)..."
        build_production
        print_info "Deploy dist/ contents to: /var/www/html/ or equivalent"
    fi
    
    # Restart nginx to serve new files
    print_step "Restarting Nginx..."
    
    # Try multiple nginx container names
    NGINX_RESTARTED=false
    
    # Try fastpay_nginx (manual container)
    if docker ps -a --format "{{.Names}}" 2>/dev/null | grep -q "^fastpay_nginx$"; then
        if timeout 30 docker restart fastpay_nginx &>/dev/null; then
            print_success "Nginx restarted (fastpay_nginx)!"
            NGINX_RESTARTED=true
        fi
    fi
    
    # Try fastpay_be_nginx_1 (docker-compose container)
    if [ "$NGINX_RESTARTED" = false ] && docker ps -a --format "{{.Names}}" 2>/dev/null | grep -q "^fastpay_be_nginx_1$"; then
        if timeout 30 docker restart fastpay_be_nginx_1 &>/dev/null; then
            print_success "Nginx restarted (fastpay_be_nginx_1)!"
            NGINX_RESTARTED=true
        fi
    fi
    
    # Try docker-compose restart
    if [ "$NGINX_RESTARTED" = false ] && command -v docker-compose &> /dev/null; then
        cd "$BACKEND_DIR"
        if timeout 30 docker-compose restart nginx &>/dev/null; then
            print_success "Nginx restarted (docker-compose)!"
            NGINX_RESTARTED=true
        fi
    fi
    
    if [ "$NGINX_RESTARTED" = false ]; then
        print_warning "Could not restart nginx automatically."
        print_info "Please restart manually:"
        print_info "  docker restart fastpay_nginx"
        print_info "  or"
        print_info "  docker restart fastpay_be_nginx_1"
    fi
    
    # Wait a moment for nginx to start
    sleep 2
    
    # Test dashboard
    print_step "Testing dashboard..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://72.60.202.91/ 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Dashboard is accessible! (HTTP $HTTP_CODE)"
    elif [ "$HTTP_CODE" = "403" ]; then
        print_warning "Dashboard returned 403. Check nginx configuration."
    elif [ "$HTTP_CODE" = "000" ]; then
        print_warning "Could not reach dashboard. Check if nginx is running."
    else
        print_info "Dashboard returned HTTP $HTTP_CODE"
    fi
    
    echo ""
    if [ "$env" = "test" ] || [ "$env" = "local" ]; then
        print_success "Dashboard deployed to test!"
        print_info "Access at: http://72.60.202.91/test/"
    else
        print_success "Dashboard deployed to production!"
        print_info "Access at: http://72.60.202.91/"
    fi
}

# Clean build artifacts
clean() {
    print_header
    print_step "Cleaning build artifacts..."
    
    if [ -d "dist" ]; then
        rm -rf dist/
        print_success "Removed dist/ directory"
    fi
    
    if [ -d "node_modules" ]; then
        read -p "Remove node_modules? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf node_modules/
            print_success "Removed node_modules/ directory"
        fi
    fi
    
    print_success "Clean complete!"
}

# Check build status
check_build() {
    print_header
    print_step "Checking build status..."
    echo ""
    
    if [ -d "dist" ]; then
        print_success "Build files exist"
        echo ""
        echo "Build Information:"
        echo "  Location: $DASHBOARD_DIR/dist"
        echo "  Size: $(du -sh dist/ | cut -f1)"
        echo "  Files:"
        ls -lh dist/ | tail -n +2 | awk '{print "    " $9 " (" $5 ")"}'
        echo ""
        
        # Check if index.html exists
        if [ -f "dist/index.html" ]; then
            print_success "index.html found"
        else
            print_error "index.html not found!"
        fi
        
        # Check assets
        if [ -d "dist/assets" ]; then
            asset_count=$(ls -1 dist/assets/ | wc -l)
            print_success "Assets directory found ($asset_count files)"
        else
            print_error "Assets directory not found!"
        fi
    else
        print_error "No build files found!"
        print_info "Run: ./manage-dashboard.sh build"
    fi
}

# Lint code
lint() {
    print_header
    print_step "Linting code..."
    
    check_npm
    
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        npm install
    fi
    
    npm run lint
}

# Format code
format() {
    print_header
    print_step "Formatting code..."
    
    check_npm
    
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        npm install
    fi
    
    npm run format
    print_success "Code formatted!"
}

# Check code format
format_check() {
    print_header
    print_step "Checking code format..."
    
    check_npm
    
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        npm install
    fi
    
    npm run format:check
}

# Update dependencies
update_deps() {
    print_header
    print_step "Updating dependencies..."
    
    check_npm
    
    print_info "Checking for outdated packages..."
    npm outdated || true
    
    echo ""
    read -p "Update all dependencies? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm update
        print_success "Dependencies updated!"
    else
        print_info "Update cancelled"
    fi
}

# View environment variables
show_env() {
    print_header
    print_step "Environment Configuration:"
    echo ""
    
    if [ -f ".env.production" ]; then
        echo -e "${BLUE}Production (.env.production):${NC}"
        cat .env.production | grep -v "^#" | grep -v "^$" | sed 's/^/  /'
    else
        print_error ".env.production not found"
    fi
    
    echo ""
    if [ -f ".env.local" ]; then
        echo -e "${BLUE}Local (.env.local):${NC}"
        cat .env.local | grep -v "^#" | grep -v "^$" | sed 's/^/  /'
    else
        print_info ".env.local not found"
    fi
}

# Git operations
git_status() {
    print_header
    print_step "Git Status:"
    echo ""
    
    if [ -d ".git" ]; then
        git status
        echo ""
        git log --oneline -5
    else
        print_error "Not a git repository"
    fi
}

git_pull() {
    print_header
    print_step "Pulling latest changes..."
    
    if [ -d ".git" ]; then
        git pull
        print_success "Code updated!"
        
        # Check if package.json changed
        if git diff HEAD@{1} HEAD -- package.json &> /dev/null; then
            print_info "package.json changed, you may want to run: npm install"
        fi
    else
        print_error "Not a git repository"
    fi
}

# Test production build locally
preview() {
    print_header
    print_step "Previewing production build..."
    
    if [ ! -d "dist" ]; then
        print_info "No build found, building..."
        build_production
    fi
    
    check_npm
    
    print_info "Starting preview server..."
    print_info "Access at: http://localhost:4173"
    print_info "Press Ctrl+C to stop"
    echo ""
    
    npm run preview
}

# Show project info
project_info() {
    print_header
    echo "Project Information:"
    echo ""
    echo "  Directory: $DASHBOARD_DIR"
    echo "  Framework: React + TypeScript + Vite"
    echo "  Package Manager: npm"
    echo ""
    
    if [ -f "package.json" ]; then
        echo "  Package Info:"
        echo "    Name: $(grep '"name"' package.json | cut -d'"' -f4)"
        echo "    Version: $(grep '"version"' package.json | cut -d'"' -f4)"
    fi
    
    echo ""
    echo "  Scripts Available:"
    if [ -f "package.json" ]; then
        grep -A 10 '"scripts"' package.json | grep -E '^\s+"' | sed 's/^/    /'
    fi
    echo ""
}

# Main menu
show_menu() {
    print_header
    echo "Dashboard Management Options:"
    echo ""
    echo "  Development:"
    echo "    1) Install Dependencies"
    echo "    2) Start Development Server"
    echo "    3) Preview Production Build"
    echo ""
    echo "  Build & Deploy:"
    echo "    4) Build for Production (72.60.202.91/)"
    echo "    5) Build for Test/Local (72.60.202.91/test/)"
    echo "    6) Deploy to Production"
    echo "    7) Deploy to Test/Local"
    echo "    8) Check Build Status"
    echo ""
    echo "  Code Quality:"
    echo "    9) Lint Code"
    echo "    10) Format Code"
    echo "    11) Check Code Format"
    echo ""
    echo "  Maintenance:"
    echo "    12) Update Dependencies"
    echo "    13) Clean Build Artifacts"
    echo "    14) Show Environment Variables"
    echo ""
    echo "  Git:"
    echo "    15) Git Status"
    echo "    16) Git Pull"
    echo ""
    echo "  Info:"
    echo "    17) Project Information"
    echo "    0) Exit"
    echo ""
    read -p "Choice [0-17]: " choice
    
    case $choice in
        1) install_deps ;;
        2) dev_server ;;
        3) preview ;;
        4) build_production ;;
        5) build_test ;;
        6) deploy production ;;
        7) deploy test ;;
        8) check_build ;;
        9) lint ;;
        10) format ;;
        11) format_check ;;
        12) update_deps ;;
        13) clean ;;
        14) show_env ;;
        15) git_status ;;
        16) git_pull ;;
        17) project_info ;;
        0) echo "Goodbye!"; exit 0 ;;
        *) echo "Invalid choice"; show_menu ;;
    esac
}

# Handle command line arguments
case "${1:-}" in
    install|deps) install_deps ;;
    dev|serve) dev_server ;;
    build) build_production ;;
    deploy) deploy ;;
    clean) clean ;;
    check|status) check_build ;;
    lint) lint ;;
    format) format ;;
    format-check) format_check ;;
    update) update_deps ;;
    env) show_env ;;
    git-status) git_status ;;
    git-pull|pull) git_pull ;;
    preview) preview ;;
    info) project_info ;;
    help|--help|-h) 
        print_header
        echo "Usage: ./manage-dashboard.sh [command]"
        echo ""
        echo "Commands:"
        echo "  install, deps      Install dependencies"
        echo "  dev, serve         Start development server"
        echo "  build              Build for production"
        echo "  deploy             Build and deploy"
        echo "  clean              Clean build artifacts"
        echo "  check, status     Check build status"
        echo "  lint               Lint code"
        echo "  format             Format code"
        echo "  format-check       Check code format"
        echo "  update             Update dependencies"
        echo "  env                Show environment variables"
        echo "  git-status         Show git status"
        echo "  git-pull, pull     Pull latest code"
        echo "  preview            Preview production build"
        echo "  info               Show project information"
        echo "  help               Show this help"
        echo ""
        echo "Or run without arguments for interactive menu"
        ;;
    *) show_menu ;;
esac
