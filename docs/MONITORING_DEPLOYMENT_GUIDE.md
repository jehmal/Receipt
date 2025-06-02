# 📊 Receipt Vault Pro - Production Monitoring Deployment Guide

## 🎯 Overview

This guide provides step-by-step instructions for deploying a complete production-ready observability stack for Receipt Vault Pro, including Prometheus, Grafana, AlertManager, Datadog APM, and comprehensive logging.

## 🏗️ Architecture Overview

### Monitoring Stack Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │────│   Datadog APM   │────│   Datadog UI    │
│                 │    │   (Tracing)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Prometheus    │────│    Grafana      │────│   Dashboards    │
│   (Metrics)     │    │   (Visualization)│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  AlertManager   │────│   PagerDuty     │────│   Slack/Email   │
│   (Alerting)    │    │   (Escalation)  │    │   (Notifications)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      Loki       │────│   Promtail      │────│   Log Analysis  │
│   (Log Storage) │    │ (Log Collection)│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start Deployment

### Prerequisites

```bash
# Ensure you have the following installed:
- Kubernetes cluster (1.24+)
- Helm 3.x
- kubectl configured
- Docker (for local testing)

# For load testing validation:
- k6
- curl
- jq
```

### 1. Deploy Core Monitoring Stack

```bash
# Deploy Prometheus, Grafana, and AlertManager
cd infrastructure/scripts
./deploy-monitoring.sh production production receipt-vault-prod

# Wait for all components to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus --timeout=600s -n monitoring
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana --timeout=600s -n monitoring
```

### 2. Configure APM (Choose One)

#### Option A: Datadog APM (Recommended for Production)

```bash
# Set your Datadog API keys
export DATADOG_API_KEY="your-datadog-api-key"
export DATADOG_APP_KEY="your-datadog-app-key"

# Deploy Datadog Agent with APM
./configure-datadog.sh receipt-vault $DATADOG_API_KEY $DATADOG_APP_KEY production
```

#### Option B: Jaeger (Open Source Alternative)

```bash
# Deploy Jaeger for distributed tracing
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm upgrade --install jaeger jaegertracing/jaeger --namespace monitoring
```

### 3. Deploy Log Aggregation

```bash
# Deploy Loki + Promtail for centralized logging
./setup-log-aggregation.sh logging production fast-ssd

# Wait for Loki to be ready
kubectl wait --for=condition=ready pod -l app=loki --timeout=300s -n logging
```

### 4. Validate Deployment

```bash
# Run comprehensive monitoring validation
./validate-monitoring.sh monitoring receipt-vault 300 10

# Check the generated report
cat monitoring-validation-report.md
```

## 📋 Detailed Configuration

### Environment Variables Setup

Create environment configuration files:

```bash
# Create production environment file
cat > env.production << EOF
# Monitoring Configuration
NODE_ENV=production
DD_SERVICE=receipt-vault-backend
DD_ENV=production
DD_VERSION=1.0.0
DD_TRACE_ENABLED=true
DD_LOGS_ENABLED=true
DD_AGENT_HOST=datadog-agent

# Application Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/receipt_vault
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secure-jwt-secret
ENCRYPTION_KEY=your-32-character-encryption-key

# External Services
GOOGLE_CLOUD_API_KEY=your-google-cloud-api-key
WORKOS_API_KEY=your-workos-api-key
WORKOS_CLIENT_ID=your-workos-client-id

# Monitoring
SENTRY_DSN=your-sentry-dsn
GRAFANA_ADMIN_PASSWORD=secure-admin-password
EOF
```

### Backend Integration

Add monitoring middleware to your Express application:

```typescript
// backend/src/index.ts
import { datadogAPM } from './monitoring/datadog-apm';
import { metricsCollector, metricsMiddleware } from './monitoring/metrics-collector';
import { errorTracker, errorTrackingMiddleware } from './monitoring/error-tracking';
import { healthCheckService } from './monitoring/health-checks';

// Initialize monitoring (must be first)
const app = express();

// Add monitoring middleware
app.use(metricsMiddleware);
app.use(addAPMContext);

// Health check endpoints
app.get('/health', async (req, res) => {
  const health = await healthCheckService.performHealthCheck();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

app.get('/health/liveness', async (req, res) => {
  const liveness = await healthCheckService.livenessCheck();
  res.status(liveness.status === 'ok' ? 200 : 503).json(liveness);
});

app.get('/health/readiness', async (req, res) => {
  const readiness = await healthCheckService.readinessCheck();
  res.status(readiness.status === 'healthy' ? 200 : 503).json(readiness);
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  const metrics = await metricsCollector.getPrometheusMetrics();
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metrics);
});

// Error handling middleware (must be last)
app.use(errorTrackingMiddleware);
```

### Dashboard Import

Import pre-configured dashboards:

```bash
# Port forward Grafana
kubectl port-forward -n monitoring svc/grafana 3000:80 &

# Import dashboards using the API
for dashboard in infrastructure/monitoring/dashboards/*.json; do
  curl -X POST \
    -H "Content-Type: application/json" \
    -d @"$dashboard" \
    http://admin:admin@localhost:3000/api/dashboards/db
done
```

### Alert Configuration

Apply alerting rules:

```bash
# Apply all alert rules
kubectl apply -f infrastructure/monitoring/alerts/

# Verify rules are loaded
kubectl port-forward -n monitoring svc/prometheus 9090:9090 &
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups | length'
```

## 🔧 Production Configuration

### Resource Requirements

```yaml
# Minimum resource requirements for production
resources:
  prometheus:
    requests:
      memory: 4Gi
      cpu: 2000m
    limits:
      memory: 8Gi
      cpu: 4000m
  
  grafana:
    requests:
      memory: 1Gi
      cpu: 500m
    limits:
      memory: 2Gi
      cpu: 1000m
  
  alertmanager:
    requests:
      memory: 256Mi
      cpu: 100m
    limits:
      memory: 512Mi
      cpu: 200m
```

### Persistence Configuration

```yaml
# Storage configuration for production
storage:
  prometheus:
    size: 100Gi
    storageClass: fast-ssd
    retention: 30d
  
  grafana:
    size: 20Gi
    storageClass: fast-ssd
  
  loki:
    size: 100Gi
    storageClass: standard
    retention: 31d
```

### High Availability Setup

```yaml
# HA configuration
replicas:
  prometheus: 2
  grafana: 2
  alertmanager: 3  # Minimum for HA
  
# Anti-affinity rules
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector:
        matchLabels:
          app: prometheus
      topologyKey: kubernetes.io/hostname
```

## 📱 Alert Notification Setup

### Slack Integration

```yaml
# AlertManager Slack configuration
slack_configs:
  - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
    channel: '#alerts-critical'
    title: 'Receipt Vault Alert: {{ .GroupLabels.alertname }}'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
    actions:
      - type: button
        text: 'View Dashboard'
        url: '{{ .Annotations.dashboard_url }}'
      - type: button
        text: 'Runbook'
        url: '{{ .Annotations.runbook_url }}'
```

### PagerDuty Integration

```yaml
# AlertManager PagerDuty configuration
pagerduty_configs:
  - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
    description: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
    details:
      alert_name: '{{ .GroupLabels.alertname }}'
      severity: '{{ .GroupLabels.severity }}'
      dashboard: '{{ .Annotations.dashboard_url }}'
      runbook: '{{ .Annotations.runbook_url }}'
```

## 🔍 Monitoring Best Practices

### 1. Metric Naming Conventions

```bash
# Follow these patterns for custom metrics:
receipt_vault_requests_total{method="POST", status="200"}
receipt_vault_request_duration_seconds{endpoint="/api/receipts"}
receipt_vault_receipts_processed_total{status="success", user_type="individual"}
receipt_vault_ocr_confidence_score{provider="google-vision"}
```

### 2. Alert Severity Levels

- **Critical**: Service disruption, requires immediate attention
- **Warning**: Performance degradation, requires attention within hours
- **Info**: Informational, may require attention within days

### 3. SLO/SLI Guidelines

```yaml
# Define clear SLOs for your service
SLOs:
  api_availability: 99.9%  # Error budget: 0.1%
  api_latency_p95: 200ms   # 95% of requests under 200ms
  receipt_processing: 99%   # Success rate
  ocr_latency_p90: 15s     # 90% under 15 seconds
```

### 4. Dashboard Organization

- **Executive Dashboard**: High-level business metrics
- **Operational Dashboard**: Service health and performance
- **Debug Dashboard**: Detailed metrics for troubleshooting
- **SLO Dashboard**: Service level objective tracking

## 🚨 Incident Response

### Alert Response Workflow

1. **Receive Alert** → Check dashboard → Assess severity
2. **Critical Alerts** → Page on-call engineer → Immediate response
3. **Warning Alerts** → Create ticket → Address within SLA
4. **Follow Runbook** → Execute documented procedures
5. **Post-Incident** → Update runbooks → Improve monitoring

### Runbook Structure

```markdown
# Alert: ServiceDown

## Description
The Receipt Vault backend service is not responding

## Severity: Critical

## Immediate Actions
1. Check service pods: `kubectl get pods -n receipt-vault`
2. Check service logs: `kubectl logs -n receipt-vault -l app=receipt-vault-backend`
3. Check resource usage: View Infrastructure dashboard

## Escalation
- If not resolved in 15 minutes, escalate to Senior Engineer
- If database related, escalate to Database Team

## Recovery Procedures
1. Restart service pods if needed
2. Check external dependencies (database, Redis)
3. Verify network connectivity

## Post-Incident
- Document root cause
- Update monitoring if needed
- Schedule post-mortem if impact > 30 minutes
```

## 📊 Performance Tuning

### Prometheus Optimization

```yaml
# Optimize Prometheus for production
prometheus:
  config:
    global:
      scrape_interval: 15s      # Balance between accuracy and load
      evaluation_interval: 15s
    
    # Reduce cardinality
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'unwanted_metric_.*'
        action: drop
    
    # Storage optimization
    retention: 30d
    retention_size: 50GB
```

### Grafana Optimization

```yaml
# Optimize Grafana performance
grafana:
  config:
    # Query optimization
    query_timeout: 30s
    max_concurrent_queries: 20
    
    # Caching
    cache:
      ttl: 5m
      max_size: 1000
```

## 🔐 Security Considerations

### Network Security

```yaml
# Network policies for monitoring
networkPolicies:
  - name: monitoring-ingress
    podSelector:
      matchLabels:
        app: prometheus
    policyTypes:
    - Ingress
    ingress:
    - from:
      - podSelector:
          matchLabels:
            app: grafana
      ports:
      - protocol: TCP
        port: 9090
```

### Authentication & Authorization

```yaml
# Grafana authentication
grafana:
  auth:
    google:
      enabled: true
      client_id: your-client-id
      client_secret: your-client-secret
      allowed_domains: yourcompany.com
      
    # RBAC configuration
    rbac:
      enabled: true
      roles:
        - name: admin
          permissions: ["admin"]
        - name: editor
          permissions: ["edit", "view"]
        - name: viewer
          permissions: ["view"]
```

## 📈 Scaling Considerations

### Horizontal Scaling

```bash
# Scale monitoring components based on load
kubectl scale deployment grafana --replicas=3 -n monitoring
kubectl scale statefulset prometheus --replicas=2 -n monitoring
```

### Vertical Scaling

```bash
# Increase resources for high-load environments
kubectl patch statefulset prometheus -n monitoring -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "prometheus",
          "resources": {
            "requests": {"memory": "8Gi", "cpu": "4000m"},
            "limits": {"memory": "16Gi", "cpu": "8000m"}
          }
        }]
      }
    }
  }
}'
```

## 🧪 Testing & Validation

### Load Testing

```bash
# Run comprehensive load test
./validate-monitoring.sh monitoring receipt-vault 600 50

# Specific metric validation
kubectl port-forward -n monitoring svc/prometheus 9090:9090 &
curl -s "http://localhost:9090/api/v1/query?query=rate(http_requests_total[5m])"
```

### Alert Testing

```bash
# Test critical alerts
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {"alertname": "TestAlert", "severity": "critical"},
    "annotations": {"summary": "Test alert for validation"}
  }]'
```

## 📝 Maintenance Procedures

### Regular Maintenance Tasks

```bash
# Weekly maintenance script
#!/bin/bash

# Clean up old metrics
kubectl exec -n monitoring prometheus-0 -- promtool query range \
  'rate(prometheus_tsdb_compactions_total[1h])' \
  --start="$(date -d '30 days ago' --iso-8601)" \
  --end="$(date --iso-8601)" \
  --step=1h

# Validate alert rules
kubectl exec -n monitoring prometheus-0 -- promtool check rules /etc/prometheus/rules/*.yml

# Check dashboard health
for dashboard in $(curl -s http://admin:admin@localhost:3000/api/search | jq -r '.[].uid'); do
  echo "Checking dashboard: $dashboard"
  curl -s "http://admin:admin@localhost:3000/api/dashboards/uid/$dashboard" | jq '.dashboard.title'
done
```

### Backup Procedures

```bash
# Backup Prometheus data
kubectl exec -n monitoring prometheus-0 -- tar -czf /tmp/prometheus-backup.tar.gz /prometheus

# Backup Grafana dashboards
curl -s http://admin:admin@localhost:3000/api/search | jq -r '.[].uid' | \
  xargs -I {} curl -s "http://admin:admin@localhost:3000/api/dashboards/uid/{}" > grafana-backup.json
```

## 🆘 Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check metric cardinality
   curl -s http://localhost:9090/api/v1/label/__name__/values | jq '. | length'
   
   # Identify high-cardinality metrics
   curl -s 'http://localhost:9090/api/v1/query?query=topk(10, count by (__name__)({__name__=~".+"}))' | jq .
   ```

2. **Missing Metrics**
   ```bash
   # Check service discovery
   curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health != "up")'
   
   # Verify ServiceMonitor configuration
   kubectl get servicemonitor -n monitoring -o yaml
   ```

3. **Alert Not Firing**
   ```bash
   # Check alert evaluation
   curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.type == "alerting")'
   
   # Test alert expression manually
   curl -s 'http://localhost:9090/api/v1/query?query=up{job="receipt-vault-backend"} == 0'
   ```

## 📚 Additional Resources

- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/)
- [Datadog APM Documentation](https://docs.datadoghq.com/tracing/)
- [SLO/SLI Guidelines](https://cloud.google.com/blog/products/gcp/sre-fundamentals-slis-slas-and-error-budgets)

---

## ✅ Deployment Checklist

- [ ] Core monitoring stack deployed (Prometheus, Grafana, AlertManager)
- [ ] APM integration configured (Datadog or Jaeger)
- [ ] Log aggregation setup (Loki + Promtail)
- [ ] Dashboards imported and validated
- [ ] Alert rules applied and tested
- [ ] SLO/SLI metrics configured
- [ ] Notification channels configured (Slack, PagerDuty)
- [ ] Load testing completed successfully
- [ ] Runbooks created and documented
- [ ] Team trained on monitoring tools
- [ ] Backup procedures implemented
- [ ] Maintenance schedule established

**🎉 Congratulations! Your Receipt Vault Pro monitoring stack is production-ready!**