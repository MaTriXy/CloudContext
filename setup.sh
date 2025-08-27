#!/bin/bash

# CloudContext - Automated Setup Script
# This script automates the entire deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Banner
echo -e "${BLUE}"
echo "   _____ _                 _  _____            _            _   "
echo "  / ____| |               | |/ ____|          | |          | |  "
echo " | |    | | ___  _   _  __| | |     ___  _ __ | |_ _____  _| |_ "
echo " | |    | |/ _ \| | | |/ _\` | |    / _ \| '_ \| __/ _ \ \/ / __|"
echo " | |____| | (_) | |_| | (_| | |___| (_) | | | | ||  __/>  <| |_ "
echo "  \_____|_|\___/ \__,_|\__,_|\_____\___/|_| |_|\__\___/_/\_\\__|"
echo -e "${NC}"
echo "Secure AI Context Storage powered by Cloudflare"
echo "================================================================"
echo ""

# Check prerequisites
print_status "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 16+"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js version 16+ is required. Current: $(node -v)"
    exit 1
fi

print_success "Prerequisites checked ✓"

# Install wrangler
if ! command -v wrangler &> /dev/null; then
    print_status "Installing Wrangler CLI..."
    npm install -g wrangler
    print_success "Wrangler installed ✓"
fi

# Login to Cloudflare
print_status "Authenticating with Cloudflare..."
wrangler login

# Get account ID
print_status "Fetching Cloudflare account..."
ACCOUNT_ID=$(wrangler whoami --json 2>/dev/null | grep -o '"account_id":"[^"]*' | cut -d'"' -f4 || true)

if [ -z "$ACCOUNT_ID" ]; then
    read -p "Enter your Cloudflare Account ID: " ACCOUNT_ID
fi

print_success "Account ID: $ACCOUNT_ID"

# Project configuration
PROJECT_NAME="cloudcontext"
read -p "Enter worker name (default: $PROJECT_NAME): " CUSTOM_NAME
PROJECT_NAME=${CUSTOM_NAME:-$PROJECT_NAME}

# Generate secure keys
print_status "Generating secure keys..."
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)
API_KEY="cc_$(openssl rand -hex 32)"

# Create R2 bucket
print_status "Creating R2 bucket..."
BUCKET_NAME="${PROJECT_NAME}-storage"
wrangler r2 bucket create "$BUCKET_NAME" 2>/dev/null || {
    print_warning "Bucket might already exist"
    read -p "Enter R2 bucket name (default: $BUCKET_NAME): " CUSTOM_BUCKET
    BUCKET_NAME=${CUSTOM_BUCKET:-$BUCKET_NAME}
}

# Create KV namespaces
print_status "Creating KV namespaces..."

METADATA_OUTPUT=$(wrangler kv:namespace create "METADATA" 2>&1 || true)
METADATA_ID=$(echo "$METADATA_OUTPUT" | grep -o 'id = "[^"]*' | cut -d'"' -f2 || true)

AUTH_OUTPUT=$(wrangler kv:namespace create "AUTH" 2>&1 || true)
AUTH_ID=$(echo "$AUTH_OUTPUT" | grep -o 'id = "[^"]*' | cut -d'"' -f2 || true)

if [ -z "$METADATA_ID" ]; then
    read -p "Enter METADATA namespace ID (or press Enter to skip): " METADATA_ID
fi

if [ -z "$AUTH_ID" ]; then
    read -p "Enter AUTH namespace ID (or press Enter to skip): " AUTH_ID
fi

# Add API key to auth namespace
if [ -n "$AUTH_ID" ]; then
    print_status "Configuring authentication..."
    echo "default_user" | wrangler kv:key put "apikey:${API_KEY}" --namespace-id="$AUTH_ID" 2>/dev/null || true
fi

# Create wrangler.toml
print_status "Creating configuration..."
cat > wrangler.toml << EOF
name = "${PROJECT_NAME}"
main = "src/worker.js"
compatibility_date = "2024-01-01"
account_id = "${ACCOUNT_ID}"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "${BUCKET_NAME}"

[[kv_namespaces]]
binding = "KV_METADATA"
id = "${METADATA_ID}"

[[kv_namespaces]]
binding = "KV_AUTH"
id = "${AUTH_ID}"

[vars]
JWT_SECRET = "${JWT_SECRET}"
ENCRYPTION_KEY = "${ENCRYPTION_KEY}"
EOF

# Create .env
cat > .env << EOF
# CloudContext Configuration
API_KEY=${API_KEY}
WORKER_URL=https://${PROJECT_NAME}.${ACCOUNT_ID}.workers.dev
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
ACCOUNT_ID=${ACCOUNT_ID}
BUCKET_NAME=${BUCKET_NAME}
EOF

# Install dependencies
print_status "Installing dependencies..."
npm install

# Deploy
print_status "Deploying to Cloudflare Workers..."
wrangler deploy

WORKER_URL="https://${PROJECT_NAME}.${ACCOUNT_ID}.workers.dev"

# Test deployment
print_status "Testing deployment..."
sleep 3

if curl -s "${WORKER_URL}/api/health" | grep -q "healthy"; then
    print_success "Deployment successful! ✓"
else
    print_warning "Deployment may need a moment to propagate."
fi

# Final output
echo ""
echo "================================================================"
echo -e "${GREEN}✅ CloudContext Setup Complete!${NC}"
echo "================================================================"
echo ""
echo -e "${BLUE}🌐 API Endpoint:${NC} ${WORKER_URL}"
echo -e "${BLUE}🔑 API Key:${NC} ${API_KEY}"
echo ""
echo -e "${YELLOW}⚠️  Save your API key securely!${NC}"
echo ""
echo "Test your deployment:"
echo "  curl ${WORKER_URL}/api/health"
echo ""
echo "Happy coding! 🚀"
