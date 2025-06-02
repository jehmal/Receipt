# Receipt Vault Pro - Terraform Variables
# Configuration variables for infrastructure deployment

# Project Configuration
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "receipt-vault-pro"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

# Networking Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# Compute Configuration
variable "instance_type" {
  description = "EC2 instance type for application servers"
  type        = string
  default     = "t3.medium"
  
  validation {
    condition = can(regex("^[tm][0-9]+[.]", var.instance_type))
    error_message = "Instance type must be a valid AWS instance type."
  }
}

variable "key_pair_name" {
  description = "AWS Key Pair name for EC2 instance access"
  type        = string
}

variable "auto_scaling_min_size" {
  description = "Minimum number of instances in Auto Scaling Group"
  type        = number
  default     = 2
}

variable "auto_scaling_max_size" {
  description = "Maximum number of instances in Auto Scaling Group"
  type        = number
  default     = 10
}

variable "auto_scaling_desired_capacity" {
  description = "Desired number of instances in Auto Scaling Group"
  type        = number
  default     = 2
}

variable "app_port" {
  description = "Port on which the application runs"
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "Health check endpoint path"
  type        = string
  default     = "/health"
}

# Database Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage for RDS (GB)"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS auto-scaling (GB)"
  type        = number
  default     = 100
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment for RDS"
  type        = bool
  default     = true
}

variable "db_backup_retention_period" {
  description = "RDS backup retention period (days)"
  type        = number
  default     = 7
  
  validation {
    condition     = var.db_backup_retention_period >= 1 && var.db_backup_retention_period <= 35
    error_message = "Backup retention period must be between 1 and 35 days."
  }
}

# Storage Configuration
variable "s3_versioning_enabled" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = true
}

variable "cloudfront_price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"
  
  validation {
    condition = contains([
      "PriceClass_All",
      "PriceClass_200", 
      "PriceClass_100"
    ], var.cloudfront_price_class)
    error_message = "Price class must be PriceClass_All, PriceClass_200, or PriceClass_100."
  }
}

# Monitoring Configuration
variable "log_retention_days" {
  description = "CloudWatch log retention period (days)"
  type        = number
  default     = 30
  
  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653
    ], var.log_retention_days)
    error_message = "Log retention must be a valid CloudWatch retention period."
  }
}

variable "alert_email" {
  description = "Email address for monitoring alerts"
  type        = string
  
  validation {
    condition     = can(regex("^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$", var.alert_email))
    error_message = "Alert email must be a valid email address."
  }
}

# Application Secrets
variable "workos_api_key" {
  description = "WorkOS API key for authentication"
  type        = string
  sensitive   = true
}

variable "workos_client_id" {
  description = "WorkOS client ID for authentication"
  type        = string
  sensitive   = true
}

# Feature Flags
variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring and alerts"
  type        = bool
  default     = true
}

variable "enable_backup" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "enable_ssl" {
  description = "Enable SSL/TLS termination at load balancer"
  type        = bool
  default     = true
}

# Cost Optimization
variable "schedule_instances" {
  description = "Enable instance scheduling for cost optimization (staging only)"
  type        = bool
  default     = false
}

variable "spot_instances_enabled" {
  description = "Use spot instances for cost optimization"
  type        = bool
  default     = false
}

# Security Configuration
variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the application"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "enable_waf" {
  description = "Enable AWS WAF for application protection"
  type        = bool
  default     = true
}

variable "ssl_certificate_arn" {
  description = "ARN of SSL certificate for HTTPS"
  type        = string
  default     = ""
}

# Domain Configuration
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID for domain"
  type        = string
  default     = ""
}

# Environment-specific configurations
variable "environment_config" {
  description = "Environment-specific configuration overrides"
  type = object({
    instance_type    = optional(string)
    min_size        = optional(number)
    max_size        = optional(number)
    db_instance_class = optional(string)
    enable_monitoring = optional(bool)
  })
  default = {}
}