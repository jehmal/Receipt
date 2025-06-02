# Receipt Vault Pro - Terraform Outputs
# Important values for application configuration and monitoring

# Network Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.networking.private_subnet_ids
}

# Load Balancer Outputs
output "load_balancer_dns_name" {
  description = "DNS name of the load balancer"
  value       = module.compute.load_balancer_dns_name
}

output "load_balancer_zone_id" {
  description = "Zone ID of the load balancer"
  value       = module.compute.load_balancer_zone_id
}

output "load_balancer_arn" {
  description = "ARN of the load balancer"
  value       = module.compute.load_balancer_arn
}

# Database Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.database.rds_endpoint
  sensitive   = true
}

output "rds_port" {
  description = "RDS instance port"
  value       = module.database.rds_port
}

output "rds_database_name" {
  description = "RDS database name"
  value       = module.database.rds_database_name
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = module.database.redis_endpoint
  sensitive   = true
}

output "redis_port" {
  description = "Redis cluster port"
  value       = module.database.redis_port
}

# Storage Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket for receipts"
  value       = module.storage.s3_bucket_name
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = module.storage.s3_bucket_arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.storage.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.storage.cloudfront_domain_name
}

# Security Outputs
output "app_security_group_id" {
  description = "Security group ID for application instances"
  value       = module.compute.app_security_group_id
}

output "database_security_group_id" {
  description = "Security group ID for database"
  value       = module.database.database_security_group_id
}

output "secrets_manager_secret_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.app_secrets.arn
  sensitive   = true
}

# IAM Outputs
output "app_role_arn" {
  description = "ARN of the application IAM role"
  value       = aws_iam_role.app_role.arn
}

output "instance_profile_name" {
  description = "Name of the EC2 instance profile"
  value       = aws_iam_instance_profile.app_profile.name
}

# Auto Scaling Outputs
output "auto_scaling_group_name" {
  description = "Name of the Auto Scaling Group"
  value       = module.compute.auto_scaling_group_name
}

output "launch_template_id" {
  description = "ID of the launch template"
  value       = module.compute.launch_template_id
}

# Monitoring Outputs
output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = module.monitoring.log_group_name
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = module.monitoring.sns_topic_arn
}

# Application URLs
output "application_url" {
  description = "URL to access the application"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${module.compute.load_balancer_dns_name}"
}

output "api_base_url" {
  description = "Base URL for API endpoints"
  value       = var.domain_name != "" ? "https://${var.domain_name}/api" : "http://${module.compute.load_balancer_dns_name}/api"
}

# Environment Information
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

# Cost Optimization Information
output "estimated_monthly_cost" {
  description = "Estimated monthly cost (USD) - requires cost calculation"
  value = format("Estimated cost for %s environment in %s", var.environment, var.aws_region)
}

# Deployment Information
output "deployment_info" {
  description = "Important deployment information"
  value = {
    environment           = var.environment
    region               = var.aws_region
    load_balancer_url    = module.compute.load_balancer_dns_name
    database_endpoint    = module.database.rds_endpoint
    s3_bucket           = module.storage.s3_bucket_name
    cloudfront_url      = module.storage.cloudfront_domain_name
    secrets_arn         = aws_secretsmanager_secret.app_secrets.arn
  }
  sensitive = true
}

# Monitoring Dashboard URLs
output "monitoring_urls" {
  description = "URLs for monitoring dashboards"
  value = {
    cloudwatch_logs = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#logsV2:log-groups/log-group/${module.monitoring.log_group_name}"
    cloudwatch_metrics = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#metricsV2:"
    ec2_dashboard = "https://${var.aws_region}.console.aws.amazon.com/ec2/v2/home?region=${var.aws_region}#Instances:"
    rds_dashboard = "https://${var.aws_region}.console.aws.amazon.com/rds/home?region=${var.aws_region}#databases:"
  }
}