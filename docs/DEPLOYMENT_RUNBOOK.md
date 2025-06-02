# Receipt Vault Pro - Deployment Runbook

## Overview
This runbook provides step-by-step procedures for deploying Receipt Vault Pro to production, handling rollbacks, and managing the deployment lifecycle.

## Pre-Deployment Checklist

### ✅ Code Quality Gates
- [ ] All tests passing (unit, integration, e2e)
- [ ] Code coverage >= 80%
- [ ] Security scan completed (OWASP ZAP, Snyk)
- [ ] Performance benchmarks met
- [ ] API compatibility validated
- [ ] Database migrations tested

### ✅ Infrastructure Readiness
- [ ] Terraform plan reviewed and approved
- [ ] Backup systems verified
- [ ] Monitoring and alerting configured
- [ ] SSL certificates valid
- [ ] DNS records configured
- [ ] CDN caching rules updated

### ✅ Operational Readiness
- [ ] Deployment window scheduled
- [ ] Rollback plan prepared
- [ ] Team notifications sent
- [ ] On-call engineer assigned
- [ ] Customer communication prepared (if needed)

## Deployment Environments

### Environment Progression
1. **Development** → Local development
2. **Staging** → Pre-production testing
3. **Production** → Live environment

### Environment URLs
- **Staging**: https://staging.receiptvault.pro
- **Production**: https://receiptvault.pro
- **API Staging**: https://staging-api.receiptvault.pro
- **API Production**: https://api.receiptvault.pro

## Deployment Procedures

### 1. Staging Deployment

#### Automatic Staging Deployment
Staging deployments are triggered automatically on merge to `main` branch.

**Monitor the deployment:**
```bash
# Check GitHub Actions
open https://github.com/your-org/receipt-vault/actions

# Monitor staging health
curl -f https://staging-api.receiptvault.pro/health

# Check application logs
aws logs tail /receipt-vault/staging/application --follow
```

#### Manual Staging Deployment
If needed, trigger manual staging deployment:

```bash
# Using GitHub CLI
gh workflow run production-deploy.yml \
  -f environment=staging \
  -f version=$(git rev-parse HEAD)

# Or via GitHub UI
# Go to Actions → Production Deployment Pipeline → Run workflow
```

#### Staging Validation
```bash
# 1. Health check
curl -f https://staging-api.receiptvault.pro/health

# 2. Authentication test
curl -X POST https://staging-api.receiptvault.pro/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@receiptvault.pro","password":"test123"}'

# 3. Upload test
curl -X POST https://staging-api.receiptvault.pro/api/v2/receipts \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-receipt.jpg" \
  -F "category=test"

# 4. Database connectivity
aws rds describe-db-instances --db-instance-identifier receipt-vault-staging

# 5. Redis connectivity
redis-cli -h staging-redis.receiptvault.pro ping
```

### 2. Production Deployment

#### Prerequisites
- [ ] Staging deployment successful and validated
- [ ] Business approval obtained
- [ ] Deployment window confirmed
- [ ] All stakeholders notified

#### Step 1: Pre-deployment Tasks
```bash
# 1. Backup current database
aws rds create-db-snapshot \
  --db-instance-identifier receipt-vault-production \
  --db-snapshot-identifier receipt-vault-$(date +%Y%m%d-%H%M%S)

# 2. Verify backup completion
aws rds describe-db-snapshots \
  --db-snapshot-identifier receipt-vault-$(date +%Y%m%d-%H%M%S)

# 3. Check current system health
curl -f https://api.receiptvault.pro/health
curl -f https://receiptvault.pro/health

# 4. Verify monitoring systems
curl -f https://api.receiptvault.pro/metrics
```

#### Step 2: Infrastructure Deployment
```bash
# Deploy infrastructure changes
cd terraform/environments/production
terraform plan -var-file="production.tfvars"
terraform apply -var-file="production.tfvars"

# Verify infrastructure
aws ec2 describe-instances --filters "Name=tag:Environment,Values=production"
aws rds describe-db-instances --db-instance-identifier receipt-vault-production
aws elbv2 describe-load-balancers --names receipt-vault-production-alb
```

#### Step 3: Application Deployment
```bash
# Trigger production deployment
gh workflow run production-deploy.yml \
  -f environment=production \
  -f version=$(git rev-parse HEAD)

# Monitor deployment progress
gh run list --workflow=production-deploy.yml --limit=1
gh run watch $(gh run list --workflow=production-deploy.yml --limit=1 --json databaseId --jq '.[0].databaseId')
```

#### Step 4: Blue-Green Deployment Process
The deployment uses blue-green strategy automatically:

1. **Current (Blue) Environment**: Serving live traffic
2. **New (Green) Environment**: New version deployed
3. **Health Checks**: Automated validation of green environment
4. **Traffic Switch**: Gradual traffic migration from blue to green
5. **Cleanup**: Remove old blue environment after successful deployment

**Monitor the switch:**
```bash
# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn $(aws ssm get-parameter --name "/receipt-vault/production/target-group-arn" --query "Parameter.Value" --output text)

# Monitor traffic distribution
aws logs filter-log-events \
  --log-group-name /receipt-vault/production/alb \
  --start-time $(date -d '5 minutes ago' +%s)000 \
  --filter-pattern '{ $.response_code = 200 }'
```

#### Step 5: Post-Deployment Validation
```bash
# 1. Application health check
curl -f https://api.receiptvault.pro/health
curl -f https://receiptvault.pro/health

# 2. API functionality test
./scripts/production-smoke-tests.sh

# 3. Database connectivity
aws rds describe-db-instances --db-instance-identifier receipt-vault-production

# 4. File upload test
curl -X POST https://api.receiptvault.pro/api/v2/receipts \
  -H "Authorization: Bearer $PROD_TOKEN" \
  -F "file=@test-receipt.jpg" \
  -F "category=test"

# 5. Check error rates
aws logs filter-log-events \
  --log-group-name /receipt-vault/production/application \
  --start-time $(date -d '10 minutes ago' +%s)000 \
  --filter-pattern 'ERROR'

# 6. Performance metrics
curl -s https://api.receiptvault.pro/metrics | grep response_time_avg
```

## Rollback Procedures

### When to Rollback
- Application error rate > 5%
- Response time > 3 seconds
- Critical functionality broken
- Database connectivity issues
- Security vulnerability detected

### Quick Rollback (< 5 minutes)
```bash
# 1. Switch traffic back to previous target group
PREVIOUS_TG=$(aws ssm get-parameter --name "/receipt-vault/production/previous-target-group" --query "Parameter.Value" --output text)

aws elbv2 modify-listener \
  --listener-arn $(aws elbv2 describe-listeners --load-balancer-arn $(aws ssm get-parameter --name "/receipt-vault/production/alb-arn" --query "Parameter.Value" --output text) --query "Listeners[0].ListenerArn" --output text) \
  --default-actions Type=forward,TargetGroupArn=$PREVIOUS_TG

# 2. Verify rollback
curl -f https://api.receiptvault.pro/health

# 3. Monitor error rates
aws logs filter-log-events \
  --log-group-name /receipt-vault/production/application \
  --start-time $(date -d '5 minutes ago' +%s)000 \
  --filter-pattern 'ERROR'
```

### Database Rollback (if needed)
```bash
# 1. Stop application traffic
aws elbv2 modify-target-group \
  --target-group-arn $CURRENT_TG \
  --health-check-enabled

# 2. Create current database backup
aws rds create-db-snapshot \
  --db-instance-identifier receipt-vault-production \
  --db-snapshot-identifier rollback-backup-$(date +%Y%m%d-%H%M%S)

# 3. Restore from pre-deployment snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier receipt-vault-production-rollback \
  --db-snapshot-identifier $PRE_DEPLOYMENT_SNAPSHOT

# 4. Update database connection strings
aws ssm put-parameter \
  --name "/receipt-vault/production/database-url" \
  --value "postgresql://user:pass@receipt-vault-production-rollback.region.rds.amazonaws.com:5432/receiptvault" \
  --overwrite

# 5. Restart application instances
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name receipt-vault-production-asg
```

### Complete Rollback (Infrastructure + Application)
```bash
# 1. Rollback to previous Terraform state
cd terraform/environments/production
terraform plan -var-file="production.tfvars" -target=module.compute
terraform apply -var-file="production.tfvars" -target=module.compute

# 2. Rollback application code
gh workflow run production-deploy.yml \
  -f environment=production \
  -f version=$PREVIOUS_COMMIT_HASH

# 3. Verify complete rollback
./scripts/production-smoke-tests.sh
```

## Monitoring and Alerting

### Key Metrics to Monitor
- **Application Health**: `/health` endpoint response
- **Error Rate**: < 1% normal, alert at > 5%
- **Response Time**: < 500ms average, alert at > 2s
- **Database Performance**: Query time < 100ms
- **File Upload Success Rate**: > 95%
- **Authentication Success Rate**: > 99%

### Monitoring Commands
```bash
# Application metrics
curl -s https://api.receiptvault.pro/metrics

# Database metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=receipt-vault-production \
  --start-time $(date -d '1 hour ago' -Iseconds) \
  --end-time $(date -Iseconds) \
  --period 300 \
  --statistics Average

# Load balancer metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=receipt-vault-production-alb \
  --start-time $(date -d '1 hour ago' -Iseconds) \
  --end-time $(date -Iseconds) \
  --period 300 \
  --statistics Average
```

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | > 1% | > 5% |
| Response Time | > 1s | > 3s |
| CPU Usage | > 70% | > 90% |
| Memory Usage | > 80% | > 95% |
| Disk Usage | > 80% | > 90% |
| Database Connections | > 80% | > 95% |

## Troubleshooting

### Common Issues

#### 1. Deployment Timeout
**Symptoms**: Deployment hangs, instances not healthy
**Resolution**:
```bash
# Check instance logs
aws logs tail /receipt-vault/production/application --follow

# Check auto scaling events
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name receipt-vault-production-asg

# Manual instance refresh
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name receipt-vault-production-asg
```

#### 2. Database Connection Issues
**Symptoms**: 500 errors, database timeouts
**Resolution**:
```bash
# Check database status
aws rds describe-db-instances --db-instance-identifier receipt-vault-production

# Check security groups
aws ec2 describe-security-groups --group-ids sg-database

# Test connectivity from application instance
aws ssm start-session --target i-1234567890abcdef0
```

#### 3. Load Balancer Issues
**Symptoms**: 502/503 errors, traffic not routing
**Resolution**:
```bash
# Check target group health
aws elbv2 describe-target-health --target-group-arn $TARGET_GROUP_ARN

# Check listener rules
aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN

# Check security groups
aws ec2 describe-security-groups --group-ids sg-alb
```

#### 4. File Upload Issues
**Symptoms**: Upload failures, S3 errors
**Resolution**:
```bash
# Check S3 bucket permissions
aws s3api get-bucket-policy --bucket receipt-vault-production

# Test S3 connectivity
aws s3 ls s3://receipt-vault-production/

# Check CloudFront distribution
aws cloudfront get-distribution --id $DISTRIBUTION_ID
```

## Emergency Contacts

### On-Call Rotation
- **Primary**: DevOps Engineer (Slack: @devops-oncall)
- **Secondary**: Backend Lead (Slack: @backend-lead)
- **Escalation**: CTO (Slack: @cto)

### Contact Information
- **Slack**: #production-alerts
- **Email**: oncall@receiptvault.pro
- **Phone**: +1-555-ON-CALL (665-2255)

### External Services
- **AWS Support**: Case priority High
- **WorkOS Support**: support@workos.com
- **CDN Provider**: Cloudflare Enterprise Support

## Maintenance Windows

### Scheduled Maintenance
- **Window**: Saturdays 2:00-4:00 AM UTC
- **Frequency**: Monthly (first Saturday)
- **Notification**: 48 hours advance notice

### Maintenance Checklist
- [ ] Security updates applied
- [ ] Database maintenance (VACUUM, REINDEX)
- [ ] Log rotation and cleanup
- [ ] Certificate renewal check
- [ ] Backup verification
- [ ] Performance optimization
- [ ] Monitoring system health check

## Post-Deployment Tasks

### Within 1 Hour
- [ ] Monitor error rates and performance
- [ ] Verify all integrations working
- [ ] Check customer support channels
- [ ] Update deployment documentation
- [ ] Notify stakeholders of completion

### Within 24 Hours
- [ ] Review deployment metrics
- [ ] Analyze performance improvements
- [ ] Document lessons learned
- [ ] Update runbook based on experience
- [ ] Schedule post-deployment review

### Within 1 Week
- [ ] Conduct deployment retrospective
- [ ] Update deployment automation
- [ ] Review and update monitoring
- [ ] Plan next deployment improvements
- [ ] Archive deployment artifacts

## Documentation Updates

After each deployment, update:
- [ ] Deployment log with issues encountered
- [ ] Runbook improvements
- [ ] Monitoring alert thresholds
- [ ] Emergency contact information
- [ ] Infrastructure documentation

---

**Document Version**: 2.1
**Last Updated**: January 15, 2024
**Next Review**: February 15, 2024