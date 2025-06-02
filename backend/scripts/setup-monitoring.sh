#!/bin/bash

# 🔍 Receipt Vault Pro - Monitoring Setup Script
# Day 3: Observability & Monitoring Infrastructure Setup

set -e

echo "🔍 Setting up monitoring infrastructure for Receipt Vault Pro..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "Docker is running"
}

# Check if Docker Compose is available
check_docker_compose() {
    print_status "Checking Docker Compose..."
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Create monitoring directories
create_directories() {
    print_status "Creating monitoring directories..."
    
    # Create directory structure
    mkdir -p backend/src/monitoring/grafana/provisioning/datasources
    mkdir -p backend/src/monitoring/grafana/provisioning/dashboards
    mkdir -p backend/src/monitoring/grafana/dashboards
    mkdir -p backend/logs/prometheus
    mkdir -p backend/logs/grafana
    mkdir -p backend/logs/alertmanager
    
    print_success "Monitoring directories created"
}

# Generate Grafana datasource configuration
create_grafana_datasource() {
    print_status "Creating Grafana datasource configuration..."
    
    cat > backend/src/monitoring/grafana/provisioning/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    jsonData:
      timeInterval: "15s"
      queryTimeout: "60s"
      httpMethod: GET

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: false
    editable: true
EOF

    print_success "Grafana datasource configuration created"
}

# Create Grafana dashboard provisioning config
create_grafana_dashboard_config() {
    print_status "Creating Grafana dashboard configuration..."
    
    cat > backend/src/monitoring/grafana/provisioning/dashboards/dashboard.yml << 'EOF'
apiVersion: 1

providers:
  - name: 'receipt-vault-dashboards'
    orgId: 1
    folder: 'Receipt Vault Pro'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF

    # Copy the dashboard JSON to the proper location
    cp backend/src/monitoring/grafana-dashboard.json backend/src/monitoring/grafana/dashboards/
    
    print_success "Grafana dashboard configuration created"
}

# Create Alertmanager configuration
create_alertmanager_config() {
    print_status "Creating Alertmanager configuration..."
    
    cat > backend/src/monitoring/alertmanager.yml << 'EOF'
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@receiptvaultpro.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://localhost:5001/webhook'
        send_resolved: true
    email_configs:
      - to: 'admin@receiptvaultpro.com'
        subject: '🚨 Receipt Vault Pro Alert: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Labels: {{ range .Labels }}{{ .Name }}={{ .Value }} {{ end }}
          {{ end }}

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
EOF

    print_success "Alertmanager configuration created"
}

# Install Node.js dependencies
install_dependencies() {
    print_status "Installing monitoring dependencies..."
    
    cd backend
    npm install dd-trace @sentry/node @sentry/fastify prom-client \
        @opentelemetry/api @opentelemetry/sdk-node \
        @opentelemetry/instrumentation @opentelemetry/instrumentation-fastify \
        @opentelemetry/instrumentation-http @opentelemetry/instrumentation-pg \
        @opentelemetry/exporter-datadog express-status-monitor \
        clinic autocannon
    cd ..
    
    print_success "Dependencies installed"
}

# Create monitoring environment file
create_monitoring_env() {
    print_status "Creating monitoring environment configuration..."
    
    if [ ! -f backend/env.monitoring ]; then
        print_warning "env.monitoring not found, creating from template..."
        
        cat > backend/.env.monitoring << 'EOF'
# Copy this to .env.monitoring and update with your actual values

# DataDog Configuration (optional)
DD_API_KEY=your_datadog_api_key_here
DD_SITE=datadoghq.com

# Sentry Configuration (optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Application Configuration
NODE_ENV=development
APP_VERSION=1.0.0
SERVICE_NAME=receipt-vault-pro

# Monitoring Features
DD_TRACE_ENABLED=false
SENTRY_ENABLED=false
PROMETHEUS_ENABLED=true
ALERTING_ENABLED=true
EOF
    fi
    
    print_success "Monitoring environment configuration created"
}

# Start monitoring stack
start_monitoring() {
    print_status "Starting monitoring stack..."
    
    cd backend
    docker-compose -f src/monitoring/docker-compose.monitoring.yml up -d
    cd ..
    
    print_success "Monitoring stack started"
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for Prometheus
    print_status "Waiting for Prometheus..."
    while ! curl -s http://localhost:9090/-/ready > /dev/null; do
        sleep 2
    done
    print_success "Prometheus is ready"
    
    # Wait for Grafana
    print_status "Waiting for Grafana..."
    while ! curl -s http://localhost:3000/api/health > /dev/null; do
        sleep 2
    done
    print_success "Grafana is ready"
}

# Display access information
show_access_info() {
    print_success "Monitoring infrastructure setup complete!"
    echo ""
    echo "📊 Access your monitoring tools:"
    echo "┌─────────────────────────────────────────────────────────────────┐"
    echo "│ Service     │ URL                          │ Credentials       │"
    echo "├─────────────────────────────────────────────────────────────────┤"
    echo "│ Grafana     │ http://localhost:3000        │ admin/admin123    │"
    echo "│ Prometheus  │ http://localhost:9090        │ No auth           │"
    echo "│ Alertmanager│ http://localhost:9093        │ No auth           │"
    echo "│ Jaeger      │ http://localhost:16686       │ No auth           │"
    echo "│ Kibana      │ http://localhost:5601        │ No auth           │"
    echo "│ cAdvisor    │ http://localhost:8080        │ No auth           │"
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo ""
    echo "🔍 Application monitoring endpoints:"
    echo "• Health Check: http://localhost:3001/health"
    echo "• Metrics: http://localhost:3001/metrics"
    echo "• Readiness: http://localhost:3001/health/ready"
    echo "• Liveness: http://localhost:3001/health/live"
    echo ""
    echo "📚 Useful commands:"
    echo "• Start monitoring: npm run monitoring:start"
    echo "• Stop monitoring: npm run monitoring:stop"
    echo "• View logs: npm run monitoring:logs"
    echo "• Load test: npm run load:test"
    echo "• Profile app: npm run profile:start"
    echo ""
    print_warning "Remember to update your .env.monitoring file with actual API keys!"
}

# Main execution
main() {
    echo "🚀 Starting Receipt Vault Pro monitoring setup..."
    
    check_docker
    check_docker_compose
    create_directories
    create_grafana_datasource
    create_grafana_dashboard_config
    create_alertmanager_config
    install_dependencies
    create_monitoring_env
    start_monitoring
    wait_for_services
    show_access_info
    
    print_success "Monitoring setup completed successfully! 🎉"
}

# Run main function
main "$@" 