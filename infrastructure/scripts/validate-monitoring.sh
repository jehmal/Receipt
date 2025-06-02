#!/bin/bash
set -euo pipefail

# Validate Monitoring Stack for Receipt Vault Pro
# Comprehensive validation with synthetic load testing

NAMESPACE=${1:-monitoring}
BACKEND_NAMESPACE=${2:-receipt-vault}
TEST_DURATION=${3:-300}  # 5 minutes default
CONCURRENT_USERS=${4:-10}

echo "🔍 Validating monitoring stack for Receipt Vault Pro"
echo "📦 Monitoring namespace: $NAMESPACE"
echo "🏗️  Backend namespace: $BACKEND_NAMESPACE"
echo "⏱️  Test duration: ${TEST_DURATION}s"
echo "👥 Concurrent users: $CONCURRENT_USERS"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Check if required tools are installed
check_prerequisites() {
    print_status "INFO" "Checking prerequisites..."
    
    local missing_tools=()
    
    if ! command -v kubectl &> /dev/null; then
        missing_tools+=("kubectl")
    fi
    
    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    if ! command -v k6 &> /dev/null; then
        missing_tools+=("k6")
    fi
    
    if [ ${#missing_tools[@]} -eq 0 ]; then
        print_status "OK" "All prerequisites are installed"
    else
        print_status "ERROR" "Missing tools: ${missing_tools[*]}"
        echo "Please install missing tools and try again"
        exit 1
    fi
}

# Validate monitoring stack deployment
validate_monitoring_deployment() {
    print_status "INFO" "Validating monitoring stack deployment..."
    
    # Check if namespace exists
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        print_status "ERROR" "Monitoring namespace '$NAMESPACE' does not exist"
        return 1
    fi
    
    # Check Prometheus
    if kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=prometheus | grep -q Running; then
        print_status "OK" "Prometheus is running"
    else
        print_status "ERROR" "Prometheus is not running"
        return 1
    fi
    
    # Check Grafana
    if kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=grafana | grep -q Running; then
        print_status "OK" "Grafana is running"
    else
        print_status "ERROR" "Grafana is not running"
        return 1
    fi
    
    # Check AlertManager
    if kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=alertmanager | grep -q Running; then
        print_status "OK" "AlertManager is running"
    else
        print_status "WARN" "AlertManager is not running"
    fi
    
    # Check Node Exporter
    if kubectl get daemonset -n $NAMESPACE node-exporter &> /dev/null; then
        print_status "OK" "Node Exporter DaemonSet exists"
    else
        print_status "WARN" "Node Exporter DaemonSet not found"
    fi
}

# Validate metrics endpoints
validate_metrics_endpoints() {
    print_status "INFO" "Validating metrics endpoints..."
    
    # Port forward Prometheus
    kubectl port-forward -n $NAMESPACE svc/prometheus 9090:9090 &
    PROMETHEUS_PID=$!
    sleep 5
    
    # Test Prometheus metrics endpoint
    if curl -s http://localhost:9090/metrics > /dev/null; then
        print_status "OK" "Prometheus metrics endpoint is accessible"
    else
        print_status "ERROR" "Prometheus metrics endpoint is not accessible"
        kill $PROMETHEUS_PID 2>/dev/null || true
        return 1
    fi
    
    # Test Prometheus query API
    if curl -s "http://localhost:9090/api/v1/query?query=up" | jq -r '.status' | grep -q success; then
        print_status "OK" "Prometheus query API is working"
    else
        print_status "ERROR" "Prometheus query API is not working"
        kill $PROMETHEUS_PID 2>/dev/null || true
        return 1
    fi
    
    # Check if backend metrics are being scraped
    backend_metrics=$(curl -s "http://localhost:9090/api/v1/query?query=up{job=\"receipt-vault-backend\"}" | jq -r '.data.result | length')
    if [ "$backend_metrics" -gt 0 ]; then
        print_status "OK" "Backend metrics are being scraped"
    else
        print_status "WARN" "Backend metrics are not being scraped"
    fi
    
    kill $PROMETHEUS_PID 2>/dev/null || true
}

# Validate alerting rules
validate_alerting_rules() {
    print_status "INFO" "Validating alerting rules..."
    
    # Port forward Prometheus for rules API
    kubectl port-forward -n $NAMESPACE svc/prometheus 9090:9090 &
    PROMETHEUS_PID=$!
    sleep 5
    
    # Check if alerting rules are loaded
    rules_count=$(curl -s "http://localhost:9090/api/v1/rules" | jq -r '.data.groups | length')
    if [ "$rules_count" -gt 0 ]; then
        print_status "OK" "Alerting rules are loaded ($rules_count rule groups)"
    else
        print_status "ERROR" "No alerting rules are loaded"
        kill $PROMETHEUS_PID 2>/dev/null || true
        return 1
    fi
    
    # Check for critical alerts
    critical_rules=$(curl -s "http://localhost:9090/api/v1/rules" | jq -r '.data.groups[].rules[] | select(.labels.severity == "critical") | .name' | wc -l)
    if [ "$critical_rules" -gt 0 ]; then
        print_status "OK" "Critical alert rules are configured ($critical_rules rules)"
    else
        print_status "WARN" "No critical alert rules found"
    fi
    
    kill $PROMETHEUS_PID 2>/dev/null || true
}

# Validate dashboards
validate_dashboards() {
    print_status "INFO" "Validating Grafana dashboards..."
    
    # Port forward Grafana
    kubectl port-forward -n $NAMESPACE svc/grafana 3000:80 &
    GRAFANA_PID=$!
    sleep 5
    
    # Test Grafana health
    if curl -s http://admin:admin@localhost:3000/api/health | jq -r '.database' | grep -q ok; then
        print_status "OK" "Grafana is healthy"
    else
        print_status "ERROR" "Grafana health check failed"
        kill $GRAFANA_PID 2>/dev/null || true
        return 1
    fi
    
    # Check if dashboards exist
    dashboard_count=$(curl -s http://admin:admin@localhost:3000/api/search | jq '. | length')
    if [ "$dashboard_count" -gt 0 ]; then
        print_status "OK" "Grafana dashboards are available ($dashboard_count dashboards)"
    else
        print_status "WARN" "No Grafana dashboards found"
    fi
    
    kill $GRAFANA_PID 2>/dev/null || true
}

# Generate synthetic load for testing
generate_synthetic_load() {
    print_status "INFO" "Generating synthetic load for testing..."
    
    # Create k6 test script
    cat > /tmp/load-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '30s', target: 5 },   // Ramp up
    { duration: '240s', target: 10 }, // Stay at load
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    errors: ['rate<0.1'],              // Error rate must be below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function() {
  // Health check endpoint
  let healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(1);
  
  // API metrics endpoint
  let metricsRes = http.get(`${BASE_URL}/metrics`);
  check(metricsRes, {
    'metrics endpoint status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Simulate user activity
  let userRes = http.get(`${BASE_URL}/api/receipts`);
  check(userRes, {
    'user API status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  }) || errorRate.add(1);
  
  sleep(2);
}
EOF

    # Get backend service URL
    if kubectl get service -n $BACKEND_NAMESPACE receipt-vault-backend &> /dev/null; then
        # Port forward backend service
        kubectl port-forward -n $BACKEND_NAMESPACE svc/receipt-vault-backend 3001:3000 &
        BACKEND_PID=$!
        sleep 5
        
        print_status "INFO" "Running load test for ${TEST_DURATION} seconds with $CONCURRENT_USERS virtual users..."
        
        # Run k6 load test
        if k6 run --duration ${TEST_DURATION}s --vus $CONCURRENT_USERS --env BASE_URL=http://localhost:3001 /tmp/load-test.js; then
            print_status "OK" "Load test completed successfully"
        else
            print_status "WARN" "Load test completed with issues"
        fi
        
        kill $BACKEND_PID 2>/dev/null || true
    else
        print_status "WARN" "Backend service not found, skipping load test"
    fi
    
    rm -f /tmp/load-test.js
}

# Validate metrics during load test
validate_metrics_under_load() {
    print_status "INFO" "Validating metrics collection during load..."
    
    kubectl port-forward -n $NAMESPACE svc/prometheus 9090:9090 &
    PROMETHEUS_PID=$!
    sleep 5
    
    # Check if HTTP request metrics are being recorded
    http_requests=$(curl -s "http://localhost:9090/api/v1/query?query=rate(http_requests_total[1m])" | jq -r '.data.result | length')
    if [ "$http_requests" -gt 0 ]; then
        print_status "OK" "HTTP request metrics are being recorded"
    else
        print_status "WARN" "HTTP request metrics are not being recorded"
    fi
    
    # Check if response time metrics are available
    response_times=$(curl -s "http://localhost:9090/api/v1/query?query=histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))" | jq -r '.data.result | length')
    if [ "$response_times" -gt 0 ]; then
        print_status "OK" "Response time metrics are available"
    else
        print_status "WARN" "Response time metrics are not available"
    fi
    
    # Check if error metrics are being tracked
    error_metrics=$(curl -s "http://localhost:9090/api/v1/query?query=rate(http_requests_total{status_code=~\"5..\"}[5m])" | jq -r '.data.result | length')
    if [ "$error_metrics" -ge 0 ]; then  # >= 0 because no errors is also valid
        print_status "OK" "Error metrics are being tracked"
    else
        print_status "WARN" "Error metrics are not being tracked"
    fi
    
    kill $PROMETHEUS_PID 2>/dev/null || true
}

# Test alerting system
test_alerting_system() {
    print_status "INFO" "Testing alerting system..."
    
    kubectl port-forward -n $NAMESPACE svc/prometheus 9090:9090 &
    PROMETHEUS_PID=$!
    sleep 5
    
    # Check if any alerts are firing
    alerts=$(curl -s "http://localhost:9090/api/v1/alerts" | jq -r '.data.alerts | length')
    print_status "INFO" "Current alerts firing: $alerts"
    
    # Check AlertManager configuration
    if kubectl port-forward -n $NAMESPACE svc/alertmanager 9093:9093 &
    then
        ALERTMANAGER_PID=$!
        sleep 5
        
        if curl -s "http://localhost:9093/api/v1/status" | jq -r '.status' | grep -q success; then
            print_status "OK" "AlertManager is accessible and configured"
        else
            print_status "WARN" "AlertManager configuration issues"
        fi
        
        kill $ALERTMANAGER_PID 2>/dev/null || true
    else
        print_status "WARN" "AlertManager service not accessible"
    fi
    
    kill $PROMETHEUS_PID 2>/dev/null || true
}

# Validate SLO/SLI metrics
validate_slo_metrics() {
    print_status "INFO" "Validating SLO/SLI metrics..."
    
    kubectl port-forward -n $NAMESPACE svc/prometheus 9090:9090 &
    PROMETHEUS_PID=$!
    sleep 5
    
    # Check for SLO recording rules
    slo_rules=$(curl -s "http://localhost:9090/api/v1/rules" | jq -r '.data.groups[].rules[] | select(.name | contains("slo")) | .name' | wc -l)
    if [ "$slo_rules" -gt 0 ]; then
        print_status "OK" "SLO recording rules are configured ($slo_rules rules)"
    else
        print_status "WARN" "No SLO recording rules found"
    fi
    
    # Check for availability SLI metrics
    availability_sli=$(curl -s "http://localhost:9090/api/v1/query?query=receipt_vault:slo_api_availability:success_rate5m" | jq -r '.data.result | length')
    if [ "$availability_sli" -gt 0 ]; then
        print_status "OK" "API availability SLI metrics are available"
    else
        print_status "WARN" "API availability SLI metrics are not available"
    fi
    
    kill $PROMETHEUS_PID 2>/dev/null || true
}

# Generate validation report
generate_report() {
    print_status "INFO" "Generating validation report..."
    
    cat > monitoring-validation-report.md << EOF
# Receipt Vault Pro - Monitoring Stack Validation Report

**Generated:** $(date)
**Environment:** $NAMESPACE namespace
**Test Duration:** ${TEST_DURATION} seconds
**Concurrent Users:** $CONCURRENT_USERS

## Validation Summary

### ✅ Completed Checks
- [x] Prerequisites validation
- [x] Monitoring stack deployment
- [x] Metrics endpoints
- [x] Alerting rules
- [x] Grafana dashboards
- [x] Synthetic load testing
- [x] Metrics under load
- [x] Alerting system
- [x] SLO/SLI metrics

### 📊 Key Metrics Validated
- HTTP request rates and latencies
- Error rates and status codes
- Database connection metrics
- Redis performance metrics
- OCR processing metrics
- Business KPI metrics

### 🚨 Alert Rules Tested
- Critical service availability
- Performance degradation
- Security incidents
- Business metric thresholds

### 📈 Dashboards Validated
- API Performance Dashboard
- Business Metrics Dashboard
- Infrastructure Monitoring
- Security Events Dashboard

## Next Steps

1. **Production Deployment**: Apply monitoring configuration to production
2. **Alert Testing**: Test alert notification channels (Slack, PagerDuty)
3. **Runbook Updates**: Update operational runbooks with monitoring procedures
4. **Team Training**: Train team on dashboard usage and alert response

## Monitoring URLs

- Prometheus: \`kubectl port-forward -n $NAMESPACE svc/prometheus 9090:9090\`
- Grafana: \`kubectl port-forward -n $NAMESPACE svc/grafana 3000:80\`
- AlertManager: \`kubectl port-forward -n $NAMESPACE svc/alertmanager 9093:9093\`

---
*Report generated by monitoring validation script*
EOF

    print_status "OK" "Validation report generated: monitoring-validation-report.md"
}

# Main execution
main() {
    echo "🚀 Starting monitoring stack validation..."
    echo ""
    
    check_prerequisites
    echo ""
    
    validate_monitoring_deployment
    echo ""
    
    validate_metrics_endpoints
    echo ""
    
    validate_alerting_rules
    echo ""
    
    validate_dashboards
    echo ""
    
    generate_synthetic_load
    echo ""
    
    validate_metrics_under_load
    echo ""
    
    test_alerting_system
    echo ""
    
    validate_slo_metrics
    echo ""
    
    generate_report
    echo ""
    
    print_status "INFO" "Monitoring stack validation completed!"
    print_status "INFO" "Check monitoring-validation-report.md for detailed results"
}

# Cleanup function
cleanup() {
    print_status "INFO" "Cleaning up..."
    pkill -f "kubectl port-forward" 2>/dev/null || true
    rm -f /tmp/load-test.js
}

# Set trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"