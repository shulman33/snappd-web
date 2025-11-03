#!/bin/bash

# =============================================================================
# Integration Test Runner
# =============================================================================
# This script manages the complete integration test lifecycle:
# 1. Ensures local Supabase is running
# 2. Starts Next.js test server on port 3001 with test environment
# 3. Waits for server to be ready
# 4. Runs integration tests
# 5. Cleans up test server process
#
# Usage:
#   ./scripts/test-integration.sh
#   ./scripts/test-integration.sh --watch  # Run in watch mode
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if watch mode is requested
WATCH_MODE=false
if [ "$1" == "--watch" ]; then
  WATCH_MODE=true
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Integration Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# =============================================================================
# Step 1: Check if local Supabase is running
# =============================================================================
echo -e "${YELLOW}[1/5]${NC} Checking local Supabase..."

if ! command -v supabase &> /dev/null; then
    echo -e "${RED}✗ Supabase CLI not found${NC}"
    echo -e "  Install it: https://supabase.com/docs/guides/cli"
    exit 1
fi

if ! supabase status &> /dev/null; then
    echo -e "${RED}✗ Local Supabase is not running${NC}"
    echo -e "  Start it with: ${GREEN}supabase start${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Local Supabase is running${NC}"
echo ""

# =============================================================================
# Step 2: Check if port 3001 is available
# =============================================================================
echo -e "${YELLOW}[2/5]${NC} Checking port 3001..."

if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${RED}✗ Port 3001 is already in use${NC}"
    echo -e "  Kill the process with: ${GREEN}lsof -ti:3001 | xargs kill${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Port 3001 is available${NC}"
echo ""

# =============================================================================
# Step 3: Start test server in background
# =============================================================================
echo -e "${YELLOW}[3/5]${NC} Starting test server on port 3001..."

# Start the test server in the background
npm run dev:test > /dev/null 2>&1 &
TEST_SERVER_PID=$!

# Cleanup function to kill test server on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Cleaning up...${NC}"
    if ps -p $TEST_SERVER_PID > /dev/null 2>&1; then
        kill $TEST_SERVER_PID 2>/dev/null || true
        echo -e "${GREEN}✓ Test server stopped${NC}"
    fi
}

# Register cleanup function to run on script exit
trap cleanup EXIT INT TERM

# Wait for server to be ready (max 30 seconds)
echo -e "  Waiting for server to start..."
MAX_WAIT=30
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Test server is ready${NC}"
        break
    fi

    # Check if process is still running
    if ! ps -p $TEST_SERVER_PID > /dev/null 2>&1; then
        echo -e "${RED}✗ Test server failed to start${NC}"
        exit 1
    fi

    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))

    # Show progress every 5 seconds
    if [ $((WAIT_COUNT % 5)) -eq 0 ]; then
        echo -e "  Still waiting... (${WAIT_COUNT}s)"
    fi
done

if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
    echo -e "${RED}✗ Server failed to start within ${MAX_WAIT} seconds${NC}"
    exit 1
fi

echo ""

# =============================================================================
# Step 4: Run tests
# =============================================================================
echo -e "${YELLOW}[4/5]${NC} Running integration tests..."
echo ""

if [ "$WATCH_MODE" = true ]; then
    # Run tests in watch mode (doesn't exit)
    npm run test:integration:watch
else
    # Run tests once
    npm run test:integration
fi

TEST_EXIT_CODE=$?

echo ""

# =============================================================================
# Step 5: Report results
# =============================================================================
echo -e "${YELLOW}[5/5]${NC} Test Results:"
echo ""

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
else
    echo -e "${RED}✗ Some tests failed${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"

exit $TEST_EXIT_CODE
