#!/bin/bash

# CloudContext Test Script

source .env 2>/dev/null || true

echo "Testing CloudContext..."
echo "======================"
echo ""

# Health check
echo "1. Health Check:"
curl -s "$WORKER_URL/api/health" 2>/dev/null | jq . 2>/dev/null || echo "Failed"
echo ""

# Save context
echo "2. Saving test context:"
curl -s -X POST "$WORKER_URL/api/context" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Context-ID: test" \
  -d '{"content": {"test": "Hello CloudContext!"}}' 2>/dev/null | jq . 2>/dev/null || echo "Failed"
echo ""

# Get context
echo "3. Retrieving test context:"
curl -s "$WORKER_URL/api/context" \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Context-ID: test" 2>/dev/null | jq . 2>/dev/null || echo "Failed"
echo ""

echo "Test complete!"
