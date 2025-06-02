#!/bin/bash
set -euo pipefail

# Configure Datadog APM for Receipt Vault Pro
# Production-ready distributed tracing and monitoring

NAMESPACE=${1:-receipt-vault}
DATADOG_API_KEY=${2:-$DATADOG_API_KEY}
DATADOG_APP_KEY=${3:-$DATADOG_APP_KEY}
ENVIRONMENT=${4:-production}

if [[ -z "$DATADOG_API_KEY" ]]; then
    echo "❌ Error: DATADOG_API_KEY environment variable or parameter required"
    echo "Usage: $0 [namespace] [api_key] [app_key] [environment]"
    exit 1
fi

echo "🐕 Configuring Datadog APM for Receipt Vault Pro"
echo "📦 Namespace: $NAMESPACE"
echo "🌍 Environment: $ENVIRONMENT"

# Create namespace if it doesn't exist
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Create Datadog API key secret
echo "🔑 Creating Datadog credentials secret..."
kubectl create secret generic datadog-secret \
    --from-literal=api-key="$DATADOG_API_KEY" \
    --from-literal=app-key="${DATADOG_APP_KEY:-}" \
    --namespace=$NAMESPACE \
    --dry-run=client -o yaml | kubectl apply -f -

# Add Datadog Helm repository
echo "📦 Adding Datadog Helm repository..."
helm repo add datadog https://helm.datadoghq.com
helm repo update

echo "🚀 Installing Datadog Agent with APM..."
helm upgrade --install datadog-agent datadog/datadog \
    --namespace $NAMESPACE \
    --values - <<EOF
# Datadog Agent Configuration for Receipt Vault Pro
datadog:
  apiKey: $DATADOG_API_KEY
  appKey: ${DATADOG_APP_KEY:-}
  site: datadoghq.com
  tags:
    - env:$ENVIRONMENT
    - service:receipt-vault
    - version:1.0.0
  
  # Logs collection
  logs:
    enabled: true
    containerCollectAll: true
    containerCollectUsingFiles: true
  
  # APM (Application Performance Monitoring)
  apm:
    enabled: true
    portEnabled: true
    port: 8126
    socketPath: /var/run/datadog/apm.socket
    non_local_traffic: true
  
  # Process monitoring
  processAgent:
    enabled: true
    processCollection: true
  
  # Live Process monitoring
  liveProcessCollection:
    enabled: true
  
  # Network Performance Monitoring
  networkMonitoring:
    enabled: true
  
  # Security monitoring
  securityAgent:
    enabled: true
    runtime:
      enabled: true
  
  # Kubernetes Events collection
  collectEvents: true
  
  # Leader election for cluster checks
  leaderElection: true
  
  # Cluster Agent configuration
  clusterAgent:
    enabled: true
    metricsProvider:
      enabled: true
    admissionController:
      enabled: true
      mutateUnlabelled: true
    
    # External metrics server for HPA
    externalMetrics:
      enabled: true
      port: 8443
    
    # Cluster checks
    clusterChecks:
      enabled: true

# Agent DaemonSet configuration
agents:
  image:
    repository: gcr.io/datadoghq/agent
    tag: 7.49.0
    pullPolicy: IfNotPresent
  
  # Resources
  resources:
    requests:
      cpu: 200m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi
  
  # Volumes for logs and APM
  volumeMounts:
    - name: dockersocketdir
      mountPath: /host/var/run
      mountPropagation: None
      readOnly: true
    - name: procdir
      mountPath: /host/proc
      mountPropagation: None
      readOnly: true
    - name: cgroups
      mountPath: /host/sys/fs/cgroup
      mountPropagation: None
      readOnly: true
    - name: pointerdir
      mountPath: /opt/datadog-agent/run
      mountPropagation: None
    - name: logpodpath
      mountPath: /var/log/pods
      mountPropagation: None
      readOnly: true
    - name: logcontainerpath
      mountPath: /var/lib/docker/containers
      mountPropagation: None
      readOnly: true
  
  volumes:
    - name: dockersocketdir
      hostPath:
        path: /var/run
    - name: procdir
      hostPath:
        path: /proc
    - name: cgroups
      hostPath:
        path: /sys/fs/cgroup
    - name: pointerdir
      hostPath:
        path: /opt/datadog-agent/run
        type: DirectoryOrCreate
    - name: logpodpath
      hostPath:
        path: /var/log/pods
    - name: logcontainerpath
      hostPath:
        path: /var/lib/docker/containers
  
  # Tolerations for all nodes
  tolerations:
    - effect: NoSchedule
      key: node-role.kubernetes.io/master
      operator: Exists
    - effect: NoExecute
      key: node.kubernetes.io/not-ready
      operator: Exists
      tolerationSeconds: 300
    - effect: NoExecute
      key: node.kubernetes.io/unreachable
      operator: Exists
      tolerationSeconds: 300

# Cluster Agent configuration
clusterAgent:
  image:
    repository: gcr.io/datadoghq/cluster-agent
    tag: 7.49.0
    pullPolicy: IfNotPresent
  
  replicas: 2
  
  resources:
    requests:
      cpu: 200m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi
  
  # Create PodDisruptionBudget
  createPodDisruptionBudget: true

# Kube State Metrics
kubeStateMetricsCore:
  enabled: true

# Enable cluster checks
clusterChecksRunner:
  enabled: true
  replicas: 2
  
  resources:
    requests:
      cpu: 200m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

# Service Account
agents:
  rbac:
    create: true
    serviceAccountName: datadog-agent

clusterAgent:
  rbac:
    create: true
    serviceAccountName: datadog-cluster-agent

# Enable Admission Controller for automatic APM injection
datadog:
  admissionController:
    enabled: true
    configMode: socket
    
    # Auto-inject APM tracer
    mutateUnlabelled: true
    injectConfig:
      enabled: true
      config:
        java:
          version: "1.x"
        nodejs:
          version: "4.x"
        python:
          version: "1.x"
        dotnet:
          version: "2.x"
EOF

echo "⏳ Waiting for Datadog Agent to be ready..."
kubectl wait --for=condition=ready pod -l app=datadog-agent --timeout=300s -n $NAMESPACE

echo "📊 Creating Datadog configuration for Receipt Vault services..."
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: datadog-config
  namespace: $NAMESPACE
data:
  postgres.yaml: |
    ad_identifiers:
      - postgres
      - postgresql
    init_config:
    instances:
      - host: postgresql.database.svc.cluster.local
        port: 5432
        username: datadog_user
        password: datadog_password
        dbname: receipt_vault
        ssl: require
        tags:
          - env:$ENVIRONMENT
          - service:postgresql
          - component:database
    logs:
      - type: file
        path: /var/log/postgresql/*.log
        source: postgresql
        service: postgresql
        tags:
          - env:$ENVIRONMENT

  redis.yaml: |
    ad_identifiers:
      - redis
    init_config:
    instances:
      - host: redis.cache.svc.cluster.local
        port: 6379
        tags:
          - env:$ENVIRONMENT
          - service:redis
          - component:cache
    logs:
      - type: file
        path: /var/log/redis/*.log
        source: redis
        service: redis
        tags:
          - env:$ENVIRONMENT

  nginx.yaml: |
    ad_identifiers:
      - nginx
    init_config:
    instances:
      - nginx_status_url: http://%%host%%:%%port%%/nginx_status
        tags:
          - env:$ENVIRONMENT
          - service:nginx
          - component:loadbalancer
    logs:
      - type: file
        path: /var/log/nginx/access.log
        source: nginx
        service: nginx
        tags:
          - env:$ENVIRONMENT
      - type: file
        path: /var/log/nginx/error.log
        source: nginx
        service: nginx
        tags:
          - env:$ENVIRONMENT
---
apiVersion: v1
kind: Service
metadata:
  name: datadog-agent
  namespace: $NAMESPACE
  labels:
    app: datadog-agent
spec:
  ports:
  - port: 8126
    name: traceport
    protocol: TCP
  - port: 8125
    name: dogstatsdport
    protocol: UDP
  selector:
    app: datadog-agent
EOF

echo "🏷️  Creating service labels for auto-discovery..."
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: receipt-vault-backend-metrics
  namespace: $NAMESPACE
  labels:
    app: receipt-vault-backend
  annotations:
    ad.datadoghq.com/service.check_names: '["openmetrics"]'
    ad.datadoghq.com/service.init_configs: '[{}]'
    ad.datadoghq.com/service.instances: |
      [{
        "openmetrics_endpoint": "http://%%host%%:%%port%%/metrics",
        "namespace": "receipt_vault",
        "metrics": ["*"],
        "tags": ["env:$ENVIRONMENT", "service:receipt-vault-backend"]
      }]
spec:
  ports:
  - port: 3000
    name: http
  - port: 9090
    name: metrics
  selector:
    app: receipt-vault-backend
EOF

echo "📋 Creating Datadog dashboard configuration..."
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: datadog-dashboards
  namespace: $NAMESPACE
data:
  receipt-vault-overview.json: |
    {
      "title": "Receipt Vault Pro - Overview",
      "description": "Main dashboard for Receipt Vault Pro monitoring",
      "widgets": [
        {
          "definition": {
            "type": "timeseries",
            "requests": [
              {
                "q": "avg:receipt_vault.http.requests_per_second{env:$ENVIRONMENT}",
                "display_type": "line",
                "style": {
                  "palette": "dog_classic",
                  "line_type": "solid",
                  "line_width": "normal"
                }
              }
            ],
            "title": "HTTP Requests per Second",
            "yaxis": {
              "scale": "linear",
              "min": "auto",
              "max": "auto"
            }
          },
          "layout": {
            "x": 0,
            "y": 0,
            "width": 4,
            "height": 3
          }
        },
        {
          "definition": {
            "type": "query_value",
            "requests": [
              {
                "q": "avg:receipt_vault.receipts.processed_total{env:$ENVIRONMENT}",
                "aggregator": "avg"
              }
            ],
            "title": "Receipts Processed Today",
            "precision": 0
          },
          "layout": {
            "x": 4,
            "y": 0,
            "width": 2,
            "height": 3
          }
        },
        {
          "definition": {
            "type": "query_value",
            "requests": [
              {
                "q": "avg:receipt_vault.ocr.success_rate{env:$ENVIRONMENT} * 100",
                "aggregator": "avg"
              }
            ],
            "title": "OCR Success Rate %",
            "precision": 1
          },
          "layout": {
            "x": 6,
            "y": 0,
            "width": 2,
            "height": 3
          }
        }
      ],
      "layout_type": "ordered"
    }
EOF

echo "✅ Datadog APM configuration completed!"
echo ""
echo "📋 Next steps:"
echo "1. Verify agent status: kubectl get pods -n $NAMESPACE -l app=datadog-agent"
echo "2. Check logs: kubectl logs -n $NAMESPACE -l app=datadog-agent"
echo "3. Access Datadog UI: https://app.datadoghq.com"
echo ""
echo "🔧 Application integration:"
echo "   - Add DD_TRACE_ENABLED=true to application environment"
echo "   - Set DD_SERVICE=receipt-vault-backend"
echo "   - Set DD_ENV=$ENVIRONMENT"
echo "   - Set DD_VERSION=1.0.0"
echo "   - Set DD_AGENT_HOST to Datadog agent service IP"
echo ""
echo "📊 Custom metrics integration:"
echo "   - Use DogStatsD client in application"
echo "   - Send metrics to agent on port 8125"
echo "   - Use OpenMetrics endpoint for Prometheus-style metrics"