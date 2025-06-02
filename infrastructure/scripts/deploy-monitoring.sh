#!/bin/bash
set -euo pipefail

# Deploy Monitoring Stack for Receipt Vault Pro
# Production-ready Prometheus, Grafana, and AlertManager deployment

NAMESPACE=${1:-monitoring}
ENVIRONMENT=${2:-production}
CLUSTER_NAME=${3:-receipt-vault-prod}

echo "🚀 Deploying monitoring stack to namespace: $NAMESPACE"
echo "📊 Environment: $ENVIRONMENT"
echo "🏗️  Cluster: $CLUSTER_NAME"

# Create namespace
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Add Prometheus Community Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

echo "📦 Installing Prometheus Operator..."
# Install Prometheus Operator with CRDs
helm upgrade --install prometheus-operator \
  prometheus-community/kube-prometheus-stack \
  --namespace $NAMESPACE \
  --set fullnameOverride=monitoring \
  --set alertmanager.fullnameOverride=alertmanager \
  --set prometheus.fullnameOverride=prometheus \
  --set grafana.fullnameOverride=grafana \
  --set prometheusOperator.fullnameOverride=prometheus-operator \
  --values - <<EOF
# Prometheus Configuration
prometheus:
  prometheusSpec:
    replicas: 2
    retention: 30d
    retentionSize: 50GB
    scrapeInterval: 15s
    evaluationInterval: 15s
    resources:
      requests:
        memory: 2Gi
        cpu: 1000m
      limits:
        memory: 4Gi
        cpu: 2000m
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: fast-ssd
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 100Gi
    externalLabels:
      cluster: $CLUSTER_NAME
      environment: $ENVIRONMENT
    additionalScrapeConfigs: |
      # Receipt Vault Backend
      - job_name: 'receipt-vault-backend'
        kubernetes_sd_configs:
          - role: endpoints
            namespaces:
              names:
                - default
                - receipt-vault
        relabel_configs:
          - source_labels: [__meta_kubernetes_service_name]
            action: keep
            regex: receipt-vault-backend
          - source_labels: [__meta_kubernetes_endpoint_port_name]
            action: keep
            regex: metrics
      
      # Blackbox monitoring for external endpoints
      - job_name: 'blackbox'
        metrics_path: /probe
        params:
          module: [http_2xx]
        static_configs:
          - targets:
            - https://api.receiptvault.com/health
            - https://receiptvault.com/health
        relabel_configs:
          - source_labels: [__address__]
            target_label: __param_target
          - source_labels: [__param_target]
            target_label: instance
          - target_label: __address__
            replacement: blackbox-exporter:9115

# AlertManager Configuration
alertmanager:
  alertmanagerSpec:
    replicas: 2
    retention: 120h
    resources:
      requests:
        memory: 256Mi
        cpu: 100m
      limits:
        memory: 512Mi
        cpu: 200m
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: fast-ssd
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 10Gi
  config:
    global:
      smtp_smarthost: 'localhost:587'
      smtp_from: 'alerts@receiptvault.com'
      slack_api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
    
    route:
      group_by: ['alertname', 'cluster', 'service']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 1h
      receiver: 'web.hook'
      routes:
        - match:
            severity: critical
          receiver: 'pagerduty-critical'
        - match:
            severity: warning
          receiver: 'slack-warnings'
    
    receivers:
      - name: 'web.hook'
        webhook_configs:
          - url: 'http://127.0.0.1:5001/'
      
      - name: 'pagerduty-critical'
        pagerduty_configs:
          - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
            description: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        slack_configs:
          - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
            channel: '#alerts-critical'
            title: 'Critical Alert: {{ .GroupLabels.alertname }}'
            text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
      
      - name: 'slack-warnings'
        slack_configs:
          - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
            channel: '#alerts-warnings'
            title: 'Warning: {{ .GroupLabels.alertname }}'
            text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

# Grafana Configuration
grafana:
  replicas: 2
  resources:
    requests:
      memory: 1Gi
      cpu: 500m
    limits:
      memory: 2Gi
      cpu: 1000m
  persistence:
    enabled: true
    storageClassName: fast-ssd
    size: 20Gi
  
  adminPassword: ${GRAFANA_ADMIN_PASSWORD:-admin123}
  
  grafana.ini:
    server:
      domain: grafana.receiptvault.com
      root_url: https://grafana.receiptvault.com
    
    security:
      admin_user: admin
      admin_password: \${GRAFANA_ADMIN_PASSWORD}
      secret_key: \${GRAFANA_SECRET_KEY}
    
    auth.google:
      enabled: true
      client_id: \${GOOGLE_CLIENT_ID}
      client_secret: \${GOOGLE_CLIENT_SECRET}
      scopes: https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email
      auth_url: https://accounts.google.com/o/oauth2/auth
      token_url: https://accounts.google.com/o/oauth2/token
      allowed_domains: receiptvault.com
    
    dashboards:
      default_home_dashboard_path: /var/lib/grafana/dashboards/receipt-vault-overview.json
  
  datasources:
    datasources.yaml:
      apiVersion: 1
      datasources:
        - name: Prometheus
          type: prometheus
          url: http://prometheus:9090
          access: proxy
          isDefault: true
        - name: Loki
          type: loki
          url: http://loki:3100
          access: proxy
  
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
        - name: 'default'
          orgId: 1
          folder: ''
          type: file
          disableDeletion: false
          editable: true
          options:
            path: /var/lib/grafana/dashboards

# Node Exporter for system metrics
nodeExporter:
  enabled: true

# kube-state-metrics for Kubernetes metrics
kubeStateMetrics:
  enabled: true

# CoreDNS metrics
coreDns:
  enabled: true

# Kubelet metrics
kubelet:
  enabled: true

# ETCD metrics (if accessible)
kubeEtcd:
  enabled: true

# Controller Manager metrics
kubeControllerManager:
  enabled: true

# Scheduler metrics
kubeScheduler:
  enabled: true
EOF

echo "⏳ Waiting for Prometheus Operator to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus-operator --timeout=300s -n $NAMESPACE

echo "📋 Installing Blackbox Exporter for external monitoring..."
helm upgrade --install blackbox-exporter \
  prometheus-community/prometheus-blackbox-exporter \
  --namespace $NAMESPACE \
  --values - <<EOF
config:
  modules:
    http_2xx:
      prober: http
      timeout: 10s
      http:
        preferred_ip_protocol: "ip4"
        valid_http_versions: ["HTTP/1.1", "HTTP/2"]
        valid_status_codes: [200, 301, 302]
        method: GET
        headers:
          User-Agent: "Blackbox-Exporter"
        fail_if_ssl: false
        fail_if_not_ssl: false
        tls_config:
          insecure_skip_verify: false
    
    http_post_2xx:
      prober: http
      timeout: 10s
      http:
        method: POST
        valid_status_codes: [200, 201, 202]
    
    tcp_connect:
      prober: tcp
      timeout: 10s
    
    icmp:
      prober: icmp
      timeout: 10s

serviceMonitor:
  enabled: true
  defaults:
    labels:
      app: blackbox-exporter
    interval: 30s
    scrapeTimeout: 10s
  targets:
    - name: receipt-vault-api
      url: https://api.receiptvault.com/health
      module: http_2xx
    - name: receipt-vault-web
      url: https://receiptvault.com
      module: http_2xx
EOF

echo "🔧 Installing additional exporters..."

# PostgreSQL Exporter
helm upgrade --install postgres-exporter \
  prometheus-community/prometheus-postgres-exporter \
  --namespace $NAMESPACE \
  --set config.datasource.host=postgresql.database.svc.cluster.local \
  --set config.datasource.user=prometheus_user \
  --set config.datasource.passwordSecret.name=postgres-exporter-secret \
  --set config.datasource.passwordSecret.key=password \
  --set config.datasource.database=receipt_vault \
  --set serviceMonitor.enabled=true

# Redis Exporter
helm upgrade --install redis-exporter \
  prometheus-community/prometheus-redis-exporter \
  --namespace $NAMESPACE \
  --set redisAddress=redis://redis.cache.svc.cluster.local:6379 \
  --set serviceMonitor.enabled=true

echo "📊 Creating custom ServiceMonitor for Receipt Vault backend..."
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: receipt-vault-backend
  namespace: $NAMESPACE
  labels:
    app: receipt-vault-backend
spec:
  selector:
    matchLabels:
      app: receipt-vault-backend
  endpoints:
  - port: metrics
    interval: 15s
    path: /metrics
EOF

echo "🚨 Applying alerting rules..."
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: receipt-vault-alerts
  namespace: $NAMESPACE
  labels:
    app: receipt-vault
    prometheus: kube-prometheus
    role: alert-rules
spec:
  groups:
  - name: receipt-vault.alerts
    rules:
    - alert: ReceiptVaultDown
      expr: up{job="receipt-vault-backend"} == 0
      for: 30s
      labels:
        severity: critical
        team: platform
      annotations:
        summary: "Receipt Vault backend is down"
        description: "Receipt Vault backend has been down for more than 30 seconds"
        runbook_url: "https://wiki.receiptvault.com/runbooks/backend-down"
    
    - alert: HighErrorRate
      expr: rate(http_requests_total{job="receipt-vault-backend",status=~"5.."}[5m]) / rate(http_requests_total{job="receipt-vault-backend"}[5m]) * 100 > 1
      for: 5m
      labels:
        severity: critical
        team: backend
      annotations:
        summary: "High error rate detected"
        description: "Error rate is {{ \$value }}% for the last 5 minutes"
    
    - alert: SlowResponseTime
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="receipt-vault-backend"}[5m])) > 0.2
      for: 5m
      labels:
        severity: warning
        team: backend
      annotations:
        summary: "Slow response times detected"
        description: "95th percentile response time is {{ \$value }}s"
    
    - alert: LowReceiptProcessingRate
      expr: rate(receipts_processed_total[10m]) < 0.01
      for: 10m
      labels:
        severity: warning
        team: backend
      annotations:
        summary: "Low receipt processing rate"
        description: "Receipt processing rate is below normal threshold"
    
    - alert: HighOCRFailureRate
      expr: rate(ocr_failures_total[5m]) / rate(ocr_processing_total[5m]) * 100 > 5
      for: 5m
      labels:
        severity: warning
        team: backend
      annotations:
        summary: "High OCR failure rate"
        description: "OCR failure rate is {{ \$value }}%"
EOF

echo "✅ Monitoring stack deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Access Grafana: kubectl port-forward svc/grafana 3000:80 -n $NAMESPACE"
echo "2. Access Prometheus: kubectl port-forward svc/prometheus 9090:9090 -n $NAMESPACE"
echo "3. Access AlertManager: kubectl port-forward svc/alertmanager 9093:9093 -n $NAMESPACE"
echo ""
echo "🔐 Default Grafana credentials:"
echo "   Username: admin"
echo "   Password: ${GRAFANA_ADMIN_PASSWORD:-admin123}"
echo ""
echo "⚠️  Remember to:"
echo "   - Update Slack webhook URLs in AlertManager config"
echo "   - Configure PagerDuty service key"
echo "   - Set up proper RBAC for production"
echo "   - Configure ingress for external access"