#!/bin/bash
# OWASP ZAP Automation Script for Receipt Vault Pro

ZAP_DOCKER_IMAGE="ghcr.io/zaproxy/zaproxy:stable"
TARGET_URL="http://localhost:3000"
REPORT_DIR="./security/reports"
CONFIG_FILE="./security/zap-config.conf"

# Create report directory
mkdir -p "$REPORT_DIR"

echo "Starting OWASP ZAP security scan..."

# Run baseline scan (quick passive scan)
docker run --rm \
  --network="host" \
  -v "$(pwd):/zap/wrk/:rw" \
  -t $ZAP_DOCKER_IMAGE \
  zap-baseline.py \
  -t "$TARGET_URL" \
  -r "$REPORT_DIR/zap-baseline-report.html" \
  -x "$REPORT_DIR/zap-baseline-report.xml" \
  -J "$REPORT_DIR/zap-baseline-report.json"

# Run full scan with authentication
docker run --rm \
  --network="host" \
  -v "$(pwd):/zap/wrk/:rw" \
  -t $ZAP_DOCKER_IMAGE \
  zap-full-scan.py \
  -t "$TARGET_URL" \
  -r "$REPORT_DIR/zap-full-report.html" \
  -x "$REPORT_DIR/zap-full-report.xml" \
  -J "$REPORT_DIR/zap-full-report.json" \
  -c "$CONFIG_FILE" \
  -z "-config api.key=receiptvault123"

# Run API scan
docker run --rm \
  --network="host" \
  -v "$(pwd):/zap/wrk/:rw" \
  -t $ZAP_DOCKER_IMAGE \
  zap-api-scan.py \
  -t "$TARGET_URL/api/openapi.json" \
  -f openapi \
  -r "$REPORT_DIR/zap-api-report.html" \
  -x "$REPORT_DIR/zap-api-report.xml" \
  -J "$REPORT_DIR/zap-api-report.json"

echo "Security scan completed. Reports available in $REPORT_DIR"

# Check for high-risk vulnerabilities
HIGH_RISK_COUNT=$(grep -c '"risk": "High"' "$REPORT_DIR/zap-full-report.json" || echo 0)
CRITICAL_RISK_COUNT=$(grep -c '"risk": "Critical"' "$REPORT_DIR/zap-full-report.json" || echo 0)

if [ $CRITICAL_RISK_COUNT -gt 0 ] || [ $HIGH_RISK_COUNT -gt 0 ]; then
  echo "❌ CRITICAL/HIGH risk vulnerabilities found!"
  echo "Critical: $CRITICAL_RISK_COUNT"
  echo "High: $HIGH_RISK_COUNT"
  exit 1
else
  echo "✅ No critical or high-risk vulnerabilities found"
fi
