#!/bin/bash

# OWASP ZAP Automated Security Scan Script
# Performs baseline and full security scans against the Receipt Vault Pro API

set -e

# Configuration
ZAP_PORT=${ZAP_PORT:-8080}
TARGET_URL=${TARGET_URL:-"http://localhost:3000"}
SCAN_TYPE=${SCAN_TYPE:-"baseline"}  # baseline, full, api
API_DEFINITION=${API_DEFINITION:-""}
OUTPUT_DIR=${OUTPUT_DIR:-"./security-reports"}
ZAP_IMAGE=${ZAP_IMAGE:-"owasp/zap2docker-stable"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if target is accessible
check_target() {
    log_info "Checking target accessibility: $TARGET_URL"
    
    if curl -sSf "$TARGET_URL/health" > /dev/null 2>&1; then
        log_success "Target is accessible"
    else
        log_error "Target is not accessible. Please ensure the application is running."
        exit 1
    fi
}

# Run baseline scan
run_baseline_scan() {
    log_info "Running OWASP ZAP baseline scan..."
    
    docker run --rm \
        -v "$PWD/$OUTPUT_DIR":/zap/wrk/:rw \
        -u $(id -u):$(id -g) \
        "$ZAP_IMAGE" \
        zap-baseline.py \
        -t "$TARGET_URL" \
        -r baseline-report.html \
        -J baseline-report.json \
        -x baseline-report.xml \
        -I \
        -d || true  # Don't fail on findings
    
    log_success "Baseline scan completed. Reports saved to $OUTPUT_DIR/"
}

# Run full scan
run_full_scan() {
    log_info "Running OWASP ZAP full scan..."
    
    docker run --rm \
        -v "$PWD/$OUTPUT_DIR":/zap/wrk/:rw \
        -u $(id -u):$(id -g) \
        "$ZAP_IMAGE" \
        zap-full-scan.py \
        -t "$TARGET_URL" \
        -r full-report.html \
        -J full-report.json \
        -x full-report.xml \
        -I \
        -d || true  # Don't fail on findings
    
    log_success "Full scan completed. Reports saved to $OUTPUT_DIR/"
}

# Run API scan
run_api_scan() {
    if [ -z "$API_DEFINITION" ]; then
        log_error "API_DEFINITION not provided for API scan"
        exit 1
    fi
    
    log_info "Running OWASP ZAP API scan with definition: $API_DEFINITION"
    
    docker run --rm \
        -v "$PWD/$OUTPUT_DIR":/zap/wrk/:rw \
        -v "$PWD/$API_DEFINITION":/zap/api-definition:ro \
        -u $(id -u):$(id -g) \
        "$ZAP_IMAGE" \
        zap-api-scan.py \
        -t /zap/api-definition \
        -f openapi \
        -r api-report.html \
        -J api-report.json \
        -x api-report.xml \
        -I \
        -d || true  # Don't fail on findings
    
    log_success "API scan completed. Reports saved to $OUTPUT_DIR/"
}

# Parse results and check for critical issues
check_results() {
    log_info "Analyzing scan results..."
    
    local report_file=""
    case $SCAN_TYPE in
        baseline)
            report_file="$OUTPUT_DIR/baseline-report.json"
            ;;
        full)
            report_file="$OUTPUT_DIR/full-report.json"
            ;;
        api)
            report_file="$OUTPUT_DIR/api-report.json"
            ;;
    esac
    
    if [ -f "$report_file" ]; then
        # Count high and medium severity issues
        high_issues=$(jq '.site[].alerts[] | select(.riskdesc | contains("High"))' "$report_file" 2>/dev/null | jq -s length || echo "0")
        medium_issues=$(jq '.site[].alerts[] | select(.riskdesc | contains("Medium"))' "$report_file" 2>/dev/null | jq -s length || echo "0")
        low_issues=$(jq '.site[].alerts[] | select(.riskdesc | contains("Low"))' "$report_file" 2>/dev/null | jq -s length || echo "0")
        
        log_info "Security Scan Summary:"
        log_info "  High Risk Issues: $high_issues"
        log_info "  Medium Risk Issues: $medium_issues"
        log_info "  Low Risk Issues: $low_issues"
        
        # Fail build if critical issues found
        if [ "$high_issues" -gt 0 ]; then
            log_error "Critical security vulnerabilities found! Build should fail."
            return 1
        elif [ "$medium_issues" -gt 5 ]; then
            log_warning "Multiple medium-risk vulnerabilities found. Review required."
            return 1
        else
            log_success "No critical security issues found."
            return 0
        fi
    else
        log_warning "Report file not found: $report_file"
        return 1
    fi
}

# Generate summary report
generate_summary() {
    log_info "Generating security summary..."
    
    cat > "$OUTPUT_DIR/security-summary.md" << EOF
# Security Scan Summary

**Scan Date:** $(date)
**Target:** $TARGET_URL
**Scan Type:** $SCAN_TYPE

## Results

$(check_results 2>&1)

## Next Steps

1. Review detailed reports in the security-reports directory
2. Address any high-risk vulnerabilities immediately
3. Create tickets for medium-risk issues
4. Schedule regular security scans

## Reports Generated

- HTML Report: ${SCAN_TYPE}-report.html
- JSON Report: ${SCAN_TYPE}-report.json
- XML Report: ${SCAN_TYPE}-report.xml

EOF

    log_success "Summary report generated: $OUTPUT_DIR/security-summary.md"
}

# Main execution
main() {
    log_info "Starting OWASP ZAP security scan"
    log_info "Target: $TARGET_URL"
    log_info "Scan Type: $SCAN_TYPE"
    log_info "Output Directory: $OUTPUT_DIR"
    
    # Check prerequisites
    if ! command -v docker &> /dev/null; then
        log_error "Docker is required but not installed."
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed. Result analysis will be limited."
    fi
    
    # Check target accessibility
    check_target
    
    # Run appropriate scan
    case $SCAN_TYPE in
        baseline)
            run_baseline_scan
            ;;
        full)
            run_full_scan
            ;;
        api)
            run_api_scan
            ;;
        *)
            log_error "Invalid scan type: $SCAN_TYPE. Use: baseline, full, or api"
            exit 1
            ;;
    esac
    
    # Analyze results
    if check_results; then
        generate_summary
        log_success "Security scan completed successfully!"
        exit 0
    else
        generate_summary
        log_error "Security issues found! Please review the reports."
        exit 1
    fi
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target)
            TARGET_URL="$2"
            shift 2
            ;;
        -s|--scan-type)
            SCAN_TYPE="$2"
            shift 2
            ;;
        -a|--api-definition)
            API_DEFINITION="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -t, --target URL          Target URL to scan (default: http://localhost:3000)"
            echo "  -s, --scan-type TYPE      Scan type: baseline, full, api (default: baseline)"
            echo "  -a, --api-definition FILE API definition file for API scan"
            echo "  -o, --output DIR          Output directory (default: ./security-reports)"
            echo "  -h, --help               Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 -t http://api.example.com -s baseline"
            echo "  $0 -s api -a ./api/openapi.yml"
            echo "  $0 -t https://staging.example.com -s full"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main 