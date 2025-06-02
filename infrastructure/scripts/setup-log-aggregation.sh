#!/bin/bash
set -euo pipefail

# Setup Log Aggregation for Receipt Vault Pro
# Production-ready Loki + Promtail for centralized logging

NAMESPACE=${1:-logging}
ENVIRONMENT=${2:-production}
STORAGE_CLASS=${3:-fast-ssd}

echo "📝 Setting up log aggregation stack"
echo "📦 Namespace: $NAMESPACE"
echo "🌍 Environment: $ENVIRONMENT"
echo "💾 Storage Class: $STORAGE_CLASS"

# Create namespace
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Add Grafana Helm repository for Loki
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

echo "📚 Installing Loki for log storage..."
helm upgrade --install loki grafana/loki-stack \
    --namespace $NAMESPACE \
    --values - <<EOF
# Loki Configuration for Receipt Vault Pro
loki:
  enabled: true
  persistence:
    enabled: true
    storageClassName: $STORAGE_CLASS
    size: 100Gi
  
  config:
    auth_enabled: false
    
    server:
      http_listen_port: 3100
      grpc_listen_port: 9096
      log_level: info
    
    distributor:
      ring:
        kvstore:
          store: inmemory
    
    ingester:
      lifecycler:
        ring:
          kvstore:
            store: inmemory
          replication_factor: 1
        final_sleep: 0s
      chunk_idle_period: 5m
      chunk_retain_period: 30s
      max_transfer_retries: 0
      wal:
        dir: /data/loki/wal
    
    schema_config:
      configs:
        - from: 2020-10-24
          store: boltdb-shipper
          object_store: filesystem
          schema: v11
          index:
            prefix: index_
            period: 24h
    
    storage_config:
      boltdb_shipper:
        active_index_directory: /data/loki/boltdb-shipper-active
        cache_location: /data/loki/boltdb-shipper-cache
        cache_ttl: 24h
        shared_store: filesystem
      filesystem:
        directory: /data/loki/chunks
    
    limits_config:
      enforce_metric_name: false
      reject_old_samples: true
      reject_old_samples_max_age: 168h
      retention_period: 744h  # 31 days
      ingestion_rate_mb: 10
      ingestion_burst_size_mb: 20
      max_streams_per_user: 10000
      max_line_size: 256KB
    
    chunk_store_config:
      max_look_back_period: 0s
    
    table_manager:
      retention_deletes_enabled: true
      retention_period: 744h  # 31 days
  
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 1000m
      memory: 2Gi

# Promtail Configuration for log collection
promtail:
  enabled: true
  
  config:
    server:
      http_listen_port: 3101
      grpc_listen_port: 0
    
    clients:
      - url: http://loki:3100/loki/api/v1/push
        tenant_id: receipt-vault
    
    positions:
      filename: /tmp/positions.yaml
    
    target_config:
      sync_period: 10s
    
    scrape_configs:
      # Kubernetes pod logs
      - job_name: kubernetes-pods
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels:
              - __meta_kubernetes_pod_annotation_prometheus_io_scrape
            action: keep
            regex: true
          - source_labels:
              - __meta_kubernetes_pod_annotation_prometheus_io_path
            action: replace
            target_label: __metrics_path__
            regex: (.+)
          - source_labels:
              - __address__
              - __meta_kubernetes_pod_annotation_prometheus_io_port
            action: replace
            regex: ([^:]+)(?::\d+)?;(\d+)
            replacement: \$1:\$2
            target_label: __address__
          - action: labelmap
            regex: __meta_kubernetes_pod_label_(.+)
          - source_labels:
              - __meta_kubernetes_namespace
            action: replace
            target_label: kubernetes_namespace
          - source_labels:
              - __meta_kubernetes_pod_name
            action: replace
            target_label: kubernetes_pod_name
          - source_labels:
              - __meta_kubernetes_pod_container_name
            action: replace
            target_label: kubernetes_container_name
        
        pipeline_stages:
          # Parse JSON logs
          - json:
              expressions:
                timestamp: timestamp
                level: level
                message: message
                service: service
                trace_id: trace_id
                span_id: span_id
          
          # Extract timestamp
          - timestamp:
              source: timestamp
              format: RFC3339Nano
          
          # Add labels
          - labels:
              level:
              service:
              trace_id:
              span_id:
          
          # Parse Receipt Vault specific logs
          - match:
              selector: '{kubernetes_container_name="receipt-vault-backend"}'
              stages:
                - json:
                    expressions:
                      user_id: user_id
                      receipt_id: receipt_id
                      company_id: company_id
                      operation: operation
                      duration_ms: duration_ms
                      error: error
                - labels:
                    user_id:
                    receipt_id:
                    company_id:
                    operation:
          
          # Parse OCR service logs
          - match:
              selector: '{service="ocr"}'
              stages:
                - json:
                    expressions:
                      provider: ocr_provider
                      confidence: confidence_score
                      processing_time_ms: processing_time_ms
                      file_size_bytes: file_size_bytes
                - labels:
                    provider:
                - template:
                    source: confidence
                    template: '{{ if .confidence }}confidence_{{ printf "%.0f" (.confidence | float64) }}{{ end }}'
                - labels:
                    confidence_bucket:
          
          # Parse database logs
          - match:
              selector: '{kubernetes_container_name="postgresql"}'
              stages:
                - regex:
                    expression: '^(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{3}) \[(?P<pid>\d+)\] (?P<level>\w+):\s+(?P<message>.*)'
                - timestamp:
                    source: timestamp
                    format: '2006-01-02 15:04:05.000'
                - labels:
                    level:
                    pid:
          
          # Parse nginx access logs
          - match:
              selector: '{kubernetes_container_name="nginx"}'
              stages:
                - regex:
                    expression: '^(?P<remote_addr>[\d\.]+) - (?P<remote_user>\S+) \[(?P<timestamp>[^\]]+)\] "(?P<method>\S+) (?P<path>\S+) (?P<protocol>\S+)" (?P<status>\d+) (?P<body_bytes_sent>\d+) "(?P<http_referer>[^"]*)" "(?P<http_user_agent>[^"]*)" (?P<request_time>[\d\.]+)'
                - timestamp:
                    source: timestamp
                    format: '02/Jan/2006:15:04:05 -0700'
                - labels:
                    method:
                    status:
                    remote_addr:
  
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 200m
      memory: 256Mi
  
  # Deploy as DaemonSet on all nodes
  tolerations:
    - effect: NoSchedule
      key: node-role.kubernetes.io/master
      operator: Exists

# Grafana for log visualization (if not already installed)
grafana:
  enabled: false  # Assuming Grafana is installed via monitoring stack

# Fluent Bit as alternative log collector
fluent-bit:
  enabled: false

# Log retention and cleanup
logRetention:
  enabled: true
EOF

echo "⏳ Waiting for Loki to be ready..."
kubectl wait --for=condition=ready pod -l app=loki --timeout=300s -n $NAMESPACE

echo "📊 Installing log monitoring rules..."
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: loki-alerts
  namespace: $NAMESPACE
  labels:
    app: loki
spec:
  groups:
  - name: loki.alerts
    rules:
    - alert: LokiRequestErrors
      expr: |
        100 * sum(rate(loki_request_duration_seconds_count{status_code=~"5.."}[1m])) by (namespace, job)
          /
        sum(rate(loki_request_duration_seconds_count[1m])) by (namespace, job)
          > 10
      for: 15m
      labels:
        severity: critical
        team: platform
      annotations:
        summary: "Loki request error rate too high"
        description: "The {{ \$labels.job }} job in {{ \$labels.namespace }} is experiencing {{ printf \"%.2f\" \$value }}% errors."
    
    - alert: LokiRequestLatency
      expr: |
        histogram_quantile(0.99, sum(rate(loki_request_duration_seconds_bucket[5m])) by (le, namespace, job)) > 1
      for: 5m
      labels:
        severity: critical
        team: platform
      annotations:
        summary: "Loki request latency too high"
        description: "The {{ \$labels.job }} job in {{ \$labels.namespace }} is experiencing {{ printf \"%.2f\" \$value }}s 99th percentile latency."
---
apiVersion: v1
kind: Service
metadata:
  name: loki-headless
  namespace: $NAMESPACE
  labels:
    app: loki
spec:
  clusterIP: None
  ports:
  - port: 3100
    name: http
  selector:
    app: loki
EOF

echo "🔍 Creating log analysis ConfigMap..."
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: log-analysis-queries
  namespace: $NAMESPACE
data:
  common-queries.md: |
    # Common Log Analysis Queries for Receipt Vault Pro
    
    ## Error Detection
    \`\`\`logql
    # All errors in the last hour
    {kubernetes_namespace="receipt-vault"} |= "ERROR" | json
    
    # OCR processing errors
    {service="ocr", level="error"} | json
    
    # Database connection errors
    {kubernetes_container_name="postgresql"} |~ "ERROR.*connection"
    
    # Authentication failures
    {service="receipt-vault-backend"} |= "authentication failed" | json
    \`\`\`
    
    ## Performance Monitoring
    \`\`\`logql
    # Slow requests (>1000ms)
    {service="receipt-vault-backend"} | json | duration_ms > 1000
    
    # High memory usage warnings
    {kubernetes_namespace="receipt-vault"} |= "memory" |= "high"
    
    # Database slow queries
    {kubernetes_container_name="postgresql"} |~ "slow query"
    \`\`\`
    
    ## Business Metrics
    \`\`\`logql
    # Receipt processing rate
    rate({service="receipt-vault-backend", operation="process_receipt"}[5m])
    
    # OCR confidence scores
    avg_over_time({service="ocr"} | json | unwrap confidence_score [5m])
    
    # User activity by operation
    sum by (operation) (rate({service="receipt-vault-backend"} | json [5m]))
    \`\`\`
    
    ## Security Monitoring
    \`\`\`logql
    # Failed login attempts
    {service="receipt-vault-backend", operation="login"} |= "failed"
    
    # Suspicious IP addresses (high request rate)
    topk(10, sum by (remote_addr) (rate({kubernetes_container_name="nginx"} | logfmt [5m])))
    
    # Potential injection attempts
    {kubernetes_container_name="nginx"} |~ "(?i)(union|select|insert|update|delete|drop|exec)"
    \`\`\`
    
    ## Alerting Queries
    \`\`\`logql
    # Error rate > 1% in last 5 minutes
    (
      sum(rate({kubernetes_namespace="receipt-vault", level="error"}[5m]))
      /
      sum(rate({kubernetes_namespace="receipt-vault"}[5m]))
    ) * 100 > 1
    
    # No successful receipts processed in 10 minutes
    sum(rate({service="receipt-vault-backend", operation="process_receipt", level="info"}[10m])) == 0
    \`\`\`

  dashboards.json: |
    {
      "dashboard": {
        "title": "Receipt Vault Pro - Logs Dashboard",
        "panels": [
          {
            "title": "Error Rate by Service",
            "type": "stat",
            "targets": [
              {
                "expr": "sum by (service) (rate({kubernetes_namespace=\"receipt-vault\", level=\"error\"}[5m]))",
                "legendFormat": "{{ service }}"
              }
            ]
          },
          {
            "title": "Recent Errors",
            "type": "logs",
            "targets": [
              {
                "expr": "{kubernetes_namespace=\"receipt-vault\", level=\"error\"} | json",
                "maxLines": 100
              }
            ]
          },
          {
            "title": "Request Volume by Endpoint",
            "type": "timeseries",
            "targets": [
              {
                "expr": "sum by (path) (rate({kubernetes_container_name=\"nginx\"} | logfmt [5m]))",
                "legendFormat": "{{ path }}"
              }
            ]
          },
          {
            "title": "OCR Processing Performance",
            "type": "timeseries",
            "targets": [
              {
                "expr": "avg_over_time({service=\"ocr\"} | json | unwrap processing_time_ms [5m])",
                "legendFormat": "Processing Time (ms)"
              }
            ]
          }
        ]
      }
    }
EOF

echo "🚀 Installing log analysis tools..."
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: log-retention-cleanup
  namespace: $NAMESPACE
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: log-cleanup
            image: curlimages/curl:latest
            command:
            - /bin/sh
            - -c
            - |
              # Delete logs older than 31 days
              curl -X POST "http://loki:3100/loki/api/v1/delete" \
                -H "Content-Type: application/json" \
                -d '{
                  "query": "{kubernetes_namespace=\"receipt-vault\"}",
                  "start": "1970-01-01T00:00:00Z",
                  "end": "'$(date -d '31 days ago' -Iseconds)'"
                }'
          restartPolicy: OnFailure
---
apiVersion: v1
kind: Service
metadata:
  name: loki-gateway
  namespace: $NAMESPACE
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3100
    name: http
  selector:
    app: loki
EOF

echo "✅ Log aggregation setup completed!"
echo ""
echo "📋 Access Information:"
echo "   - Loki endpoint: http://loki.$NAMESPACE.svc.cluster.local:3100"
echo "   - Grafana explore: Add Loki as datasource with above URL"
echo ""
echo "🔍 Testing log ingestion:"
echo "   kubectl logs -f -n $NAMESPACE -l app=promtail"
echo ""
echo "📊 Example queries to test in Grafana:"
echo "   {kubernetes_namespace=\"receipt-vault\"}"
echo "   {service=\"receipt-vault-backend\"} | json"
echo "   {level=\"error\"} | json"
echo ""
echo "📝 Log analysis queries are available in:"
echo "   kubectl get configmap log-analysis-queries -n $NAMESPACE -o yaml"