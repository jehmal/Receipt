# Receipt Vault Pro - Incident Response Playbook

## Overview
This playbook provides structured procedures for responding to production incidents, minimizing downtime, and ensuring rapid recovery of Receipt Vault Pro services.

## Incident Classification

### Severity Levels

#### Severity 1 (Critical)
- **Definition**: Complete service outage or security breach
- **Examples**: 
  - API completely unavailable
  - Data loss or corruption
  - Security breach with data exposure
  - Payment processing failure
- **Response Time**: 15 minutes
- **Resolution Target**: 1 hour

#### Severity 2 (High)
- **Definition**: Major functionality impaired
- **Examples**:
  - Receipt upload failures > 50%
  - Authentication system degraded
  - Database performance issues
  - High error rates (>10%)
- **Response Time**: 30 minutes
- **Resolution Target**: 4 hours

#### Severity 3 (Medium)
- **Definition**: Minor functionality affected
- **Examples**:
  - Individual feature not working
  - Performance degradation
  - Non-critical integrations down
  - Error rates 5-10%
- **Response Time**: 2 hours
- **Resolution Target**: 24 hours

#### Severity 4 (Low)
- **Definition**: Minimal impact on users
- **Examples**:
  - Cosmetic issues
  - Documentation errors
  - Minor performance issues
  - Error rates 1-5%
- **Response Time**: Next business day
- **Resolution Target**: 1 week

## Incident Response Team

### Primary Responders
- **Incident Commander**: DevOps Lead
- **Technical Lead**: Backend Senior Engineer
- **Communications Lead**: Product Manager
- **Customer Success**: Support Team Lead

### Escalation Path
1. **Level 1**: On-call Engineer
2. **Level 2**: Team Lead
3. **Level 3**: Engineering Manager
4. **Level 4**: CTO
5. **Level 5**: CEO (for critical security/business impact)

### Contact Information
- **Primary On-call**: Slack @oncall-primary
- **Secondary On-call**: Slack @oncall-secondary
- **Emergency Phone**: +1-555-INCIDENT (462-4336)
- **Status Page**: https://status.receiptvault.pro

## Incident Detection

### Automated Alerts
- **Prometheus/Grafana**: System metrics
- **DataDog APM**: Application performance
- **AWS CloudWatch**: Infrastructure metrics
- **Sentry**: Application errors
- **Pingdom**: External monitoring

### Alert Channels
- **Slack**: #production-alerts
- **PagerDuty**: Escalation for Sev 1/2
- **Email**: oncall@receiptvault.pro
- **SMS**: Critical alerts only

### Manual Detection
- **Customer Reports**: Support tickets
- **Internal Discovery**: Team members
- **Security Monitoring**: SOC alerts
- **Business Metrics**: Revenue/usage drops

## Incident Response Procedures

### 1. Initial Response (0-15 minutes)

#### Acknowledge and Assess
```bash
# 1. Acknowledge the alert
curl -X POST https://api.pagerduty.com/incidents/{incident_id}/acknowledge \
  -H "Authorization: Token token=YOUR_API_KEY"

# 2. Check system health
curl -f https://api.receiptvault.pro/health
curl -f https://receiptvault.pro/health

# 3. Quick metric review
curl -s https://api.receiptvault.pro/metrics | grep -E "(error_rate|response_time|uptime)"
```

#### Classify Severity
Use the severity matrix above to determine impact level.

#### Assemble Team
- **Sev 1**: Full incident team + management
- **Sev 2**: Incident team
- **Sev 3**: Primary responder + backup
- **Sev 4**: Primary responder

#### Communication Setup
```bash
# Create incident channel
curl -X POST https://slack.com/api/conversations.create \
  -H "Authorization: Bearer $SLACK_TOKEN" \
  -d "name=incident-$(date +%Y%m%d-%H%M%S)"

# Post to main alert channel
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_TOKEN" \
  -d "channel=#production-alerts" \
  -d "text=🚨 INCIDENT: [SEV-X] Brief description - War room: #incident-channel"
```

### 2. Investigation and Diagnosis (15-45 minutes)

#### System Status Check
```bash
# Application health
curl -v https://api.receiptvault.pro/health 2>&1 | grep -E "(< HTTP|error)"

# Database connectivity
aws rds describe-db-instances \
  --db-instance-identifier receipt-vault-production \
  --query 'DBInstances[0].DBInstanceStatus'

# Redis connectivity
redis-cli -h production-redis.receiptvault.pro ping

# Load balancer status
aws elbv2 describe-target-health \
  --target-group-arn $(aws ssm get-parameter --name "/receipt-vault/production/target-group-arn" --query "Parameter.Value" --output text)

# File storage (S3)
aws s3 ls s3://receipt-vault-production/ --summarize
```

#### Log Analysis
```bash
# Application logs (last 30 minutes)
aws logs filter-log-events \
  --log-group-name /receipt-vault/production/application \
  --start-time $(date -d '30 minutes ago' +%s)000 \
  --filter-pattern 'ERROR'

# System logs
aws logs filter-log-events \
  --log-group-name /receipt-vault/production/system \
  --start-time $(date -d '30 minutes ago' +%s)000

# Load balancer logs
aws logs filter-log-events \
  --log-group-name /receipt-vault/production/alb \
  --start-time $(date -d '30 minutes ago' +%s)000 \
  --filter-pattern '{ $.response_code >= 500 }'
```

#### Performance Analysis
```bash
# Response time metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=receipt-vault-production-alb \
  --start-time $(date -d '1 hour ago' -Iseconds) \
  --end-time $(date -Iseconds) \
  --period 300 \
  --statistics Average,Maximum

# Error rate analysis
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --dimensions Name=LoadBalancer,Value=receipt-vault-production-alb \
  --start-time $(date -d '1 hour ago' -Iseconds) \
  --end-time $(date -Iseconds) \
  --period 300 \
  --statistics Sum
```

#### Security Check
```bash
# Check for unusual traffic patterns
aws logs filter-log-events \
  --log-group-name /receipt-vault/production/alb \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --filter-pattern '{ $.request_processing_time > 10 }'

# Authentication failures
aws logs filter-log-events \
  --log-group-name /receipt-vault/production/application \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --filter-pattern 'authentication_failed'

# Check for DDoS indicators
aws logs filter-log-events \
  --log-group-name /receipt-vault/production/waf \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --filter-pattern 'BLOCK'
```

### 3. Immediate Mitigation

#### Quick Fixes
Based on common issues:

**High Error Rate**:
```bash
# Scale up application instances
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name receipt-vault-production-asg \
  --desired-capacity 6

# Restart unhealthy instances
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name receipt-vault-production-asg \
  --preferences MinHealthyPercentage=50
```

**Database Issues**:
```bash
# Check database performance
aws rds describe-db-instances \
  --db-instance-identifier receipt-vault-production

# Scale up if needed
aws rds modify-db-instance \
  --db-instance-identifier receipt-vault-production \
  --db-instance-class db.t3.large \
  --apply-immediately
```

**File Upload Issues**:
```bash
# Check S3 status
aws s3api head-bucket --bucket receipt-vault-production

# Test upload
aws s3 cp test-file.txt s3://receipt-vault-production/test/ --storage-class STANDARD
```

#### Emergency Rollback
If recent deployment is suspected:
```bash
# Quick rollback to previous version
aws elbv2 modify-listener \
  --listener-arn $(aws elbv2 describe-listeners --load-balancer-arn $(aws ssm get-parameter --name "/receipt-vault/production/alb-arn" --query "Parameter.Value" --output text) --query "Listeners[0].ListenerArn" --output text) \
  --default-actions Type=forward,TargetGroupArn=$(aws ssm get-parameter --name "/receipt-vault/production/previous-target-group" --query "Parameter.Value" --output text)
```

### 4. Communication

#### Internal Updates
```bash
# Slack update template
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_TOKEN" \
  -d "channel=#incident-$(date +%Y%m%d)" \
  -d "text=📊 UPDATE: Issue identified as [description]. ETA for resolution: [time]. Current workaround: [if any]"
```

#### Customer Communication
For Sev 1/2 incidents, update status page:

```bash
# Create incident on status page
curl -X POST https://api.statuspage.io/v1/pages/PAGE_ID/incidents \
  -H "Authorization: OAuth YOUR_TOKEN" \
  -d "incident[name]=Service Degradation" \
  -d "incident[status]=investigating" \
  -d "incident[impact_override]=major" \
  -d "incident[body]=We are investigating reports of service issues."
```

#### Stakeholder Notifications
- **Sev 1**: Immediate notification to leadership
- **Sev 2**: Within 30 minutes
- **Customer Success**: For user-facing issues
- **Sales Team**: For revenue-impacting issues

### 5. Resolution and Recovery

#### Validation Testing
```bash
# Health check
curl -f https://api.receiptvault.pro/health

# Functional testing
./scripts/production-smoke-tests.sh

# Performance validation
ab -n 100 -c 10 https://api.receiptvault.pro/api/v2/receipts

# Error rate check
aws logs filter-log-events \
  --log-group-name /receipt-vault/production/application \
  --start-time $(date -d '10 minutes ago' +%s)000 \
  --filter-pattern 'ERROR' | wc -l
```

#### Monitoring Reset
```bash
# Clear alert conditions
curl -X POST https://api.pagerduty.com/incidents/{incident_id}/resolve \
  -H "Authorization: Token token=YOUR_API_KEY"

# Reset monitoring thresholds if adjusted
aws cloudwatch put-metric-alarm \
  --alarm-name "receipt-vault-high-error-rate" \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:production-alerts \
  --threshold 5.0
```

### 6. Post-Incident Activities

#### Immediate (within 2 hours)
- [ ] Incident resolved confirmation
- [ ] Customer communication sent
- [ ] All alerts cleared
- [ ] Team debriefing scheduled
- [ ] Incident timeline documented

#### Short-term (within 24 hours)
- [ ] Root cause analysis completed
- [ ] Post-mortem document created
- [ ] Action items identified
- [ ] Monitoring improvements planned
- [ ] Process improvements documented

#### Long-term (within 1 week)
- [ ] Post-mortem review meeting
- [ ] Action items assigned and tracked
- [ ] Preventive measures implemented
- [ ] Documentation updated
- [ ] Team training planned

## Common Incident Scenarios

### Scenario 1: API Completely Down

**Symptoms**: All endpoints returning 5xx errors
**Investigation**:
```bash
# Check load balancer
aws elbv2 describe-target-health --target-group-arn $TG_ARN

# Check application instances
aws ec2 describe-instances --filters "Name=tag:Environment,Values=production"

# Check recent deployments
git log --oneline -10
```

**Resolution**:
1. Identify failed instances
2. Auto scaling group replacement
3. Rollback if deployment-related
4. Database connectivity check

### Scenario 2: High Error Rate (>10%)

**Symptoms**: Increased 5xx responses, slow performance
**Investigation**:
```bash
# Error analysis
aws logs filter-log-events \
  --log-group-name /receipt-vault/production/application \
  --filter-pattern 'ERROR' \
  --start-time $(date -d '1 hour ago' +%s)000

# Resource utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=AutoScalingGroupName,Value=receipt-vault-production-asg
```

**Resolution**:
1. Scale up instances if resource constrained
2. Database performance optimization
3. Rate limiting adjustment
4. Circuit breaker activation

### Scenario 3: Database Connection Issues

**Symptoms**: Database timeouts, connection errors
**Investigation**:
```bash
# Database status
aws rds describe-db-instances --db-instance-identifier receipt-vault-production

# Connection count
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections
```

**Resolution**:
1. Connection pool adjustment
2. Database scaling
3. Query optimization
4. Failover to read replica if available

### Scenario 4: File Upload Failures

**Symptoms**: S3 upload errors, storage unavailable
**Investigation**:
```bash
# S3 status
aws s3api head-bucket --bucket receipt-vault-production

# CloudFront status
aws cloudfront get-distribution --id $DISTRIBUTION_ID
```

**Resolution**:
1. S3 permissions check
2. Network connectivity verification
3. Alternative storage endpoint
4. CDN cache invalidation

## Escalation Procedures

### When to Escalate
- Incident severity increases
- Resolution time exceeds target
- Additional expertise needed
- Business impact assessment required
- Media/regulatory attention

### Escalation Contacts
1. **Technical Escalation**: Engineering Manager
2. **Business Escalation**: Product Manager
3. **Executive Escalation**: CTO
4. **Crisis Escalation**: CEO
5. **Legal/Compliance**: General Counsel

## Tools and Resources

### Monitoring Dashboards
- **Grafana**: https://monitoring.receiptvault.pro
- **DataDog**: https://app.datadoghq.com/dashboard/receipt-vault
- **AWS CloudWatch**: Console links in runbook
- **Status Page**: https://status.receiptvault.pro

### Communication Tools
- **Slack**: #production-alerts, #incident-response
- **PagerDuty**: Incident management
- **Zoom**: Video conferences for Sev 1/2
- **Status Page**: Customer communication

### Documentation
- **Runbooks**: `/docs/runbooks/`
- **Architecture**: `/docs/architecture/`
- **API Documentation**: `/docs/api/`
- **Post-mortems**: `/docs/post-mortems/`

## Training and Drills

### Monthly Drills
- Game day exercises
- Disaster recovery testing
- Communication drills
- New team member training

### Quarterly Reviews
- Process improvements
- Tool evaluation
- Contact list updates
- Scenario planning

---

**Document Version**: 1.5
**Last Updated**: January 15, 2024
**Next Drill**: February 1, 2024