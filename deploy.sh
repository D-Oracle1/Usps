#!/bin/bash

# USPS Tracking System - Vercel Deployment Script

set -e

echo "=========================================="
echo "  USPS Tracking System - Vercel Deploy"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}Error: Vercel CLI is not installed${NC}"
    echo "Install it with: npm install -g vercel"
    exit 1
fi

# Navigate to project root
cd "$(dirname "$0")"

echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
cd frontend
npm install

echo -e "${YELLOW}Step 2: Building frontend...${NC}"
npm run build

echo -e "${YELLOW}Step 3: Deploying to Vercel...${NC}"

# Deploy with production flag
if [ "$1" == "--prod" ] || [ "$1" == "-p" ]; then
    echo -e "${GREEN}Deploying to PRODUCTION...${NC}"
    vercel --prod
else
    echo -e "${YELLOW}Deploying to PREVIEW...${NC}"
    echo "(Use --prod or -p flag for production deployment)"
    vercel
fi

echo ""
echo -e "${GREEN}=========================================="
echo "  Deployment Complete!"
echo "==========================================${NC}"
