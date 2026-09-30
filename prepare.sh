#!/usr/bin/env bash
set -e

# Prevent interactive prompts (e.g., corepack Y/n prompts) and disable buggy corepack strict mode
export CI=true
export COREPACK_ENABLE_STRICT=0
export COREPACK_ENABLE_AUTO_PIN=0

# ANSI Color codes for clean output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}   APPCENTER ZIQVA - UBUNTU PRODUCTION PREPARE SCRIPT  ${NC}"
echo -e "${BLUE}=====================================================${NC}"

# 1. Clean existing node_modules to maximize Ubuntu disk space
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}[1/5] Removing existing node_modules to free up storage...${NC}"
    rm -rf node_modules
    echo -e "${GREEN}✓ Existing node_modules purged.${NC}"
else
    echo -e "${GREEN}[1/5] No previous node_modules found. Skipping purge.${NC}"
fi

# 2. Check & Install Standalone pnpm@9 (Bypassing Corepack Node 20 ESM bug)
echo -e "${BLUE}[2/5] Ensuring stable pnpm package manager...${NC}"
if command -v corepack &> /dev/null; then
    corepack disable 2>/dev/null || true
fi

PACKAGE_MANAGER="pnpm"
if ! command -v pnpm &> /dev/null || ! pnpm --version &> /dev/null; then
    echo -e "${YELLOW}Installing standalone pnpm@9 globally via npm...${NC}"
    npm install -g pnpm@9 --force 2>/dev/null || npm install -g pnpm@latest --force
fi

if command -v pnpm &> /dev/null && pnpm --version &> /dev/null; then
    echo -e "${GREEN}✓ Using pnpm version: $(pnpm --version)${NC}"
else
    echo -e "${YELLOW}pnpm not available, falling back to npm...${NC}"
    PACKAGE_MANAGER="npm"
fi

# 3. Install production dependencies cleanly
echo -e "${BLUE}[3/5] Installing production dependencies...${NC}"
if [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    pnpm install --prod --no-frozen-lockfile --ignore-scripts
else
    npm install --omit=dev --legacy-peer-deps --ignore-scripts
fi

# 4. Generate Prisma Client for Ubuntu Linux OS (Pinned to Prisma v6)
echo -e "${BLUE}[4/5] Generating Prisma Client...${NC}"
npx prisma@6 generate

# 5. Check PM2 & Manage "appcenter-ziqva" process
echo -e "${BLUE}[5/5] Managing PM2 process 'appcenter-ziqva'...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 is not installed. Installing PM2 globally via npm...${NC}"
    npm install -g pm2
fi

if pm2 list | grep -q "appcenter-ziqva"; then
    echo -e "${YELLOW}Restarting existing PM2 process 'appcenter-ziqva'...${NC}"
    pm2 restart appcenter-ziqva
else
    echo -e "${GREEN}Starting new PM2 process 'appcenter-ziqva'...${NC}"
    pm2 start server.js --name "appcenter-ziqva"
fi

pm2 save

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}  🎉 PREPARATION & DEPLOYMENT COMPLETED SUCCESSFULLY!  ${NC}"
echo -e "${GREEN}  Process Name : appcenter-ziqva                       ${NC}"
echo -e "${GREEN}=====================================================${NC}"
