# Receipt Vault Pro - Main Terraform Configuration
# Infrastructure as Code for Production Deployment

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
  }

  # Configure S3 backend for state management
  backend "s3" {
    bucket         = "receipt-vault-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "receipt-vault-pro"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "devops-team"
    }
  }
}

# Local values for resource naming and configuration
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# VPC and Networking
module "networking" {
  source = "./modules/networking"
  
  name_prefix         = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = data.aws_availability_zones.available.names
  environment        = var.environment
  
  tags = local.common_tags
}

# Compute Infrastructure
module "compute" {
  source = "./modules/compute"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  # Networking
  vpc_id              = module.networking.vpc_id
  private_subnet_ids  = module.networking.private_subnet_ids
  public_subnet_ids   = module.networking.public_subnet_ids
  
  # Instance configuration
  instance_type       = var.instance_type
  min_size           = var.auto_scaling_min_size
  max_size           = var.auto_scaling_max_size
  desired_capacity   = var.auto_scaling_desired_capacity
  
  # Security
  key_name           = var.key_pair_name
  
  # Application
  app_port           = var.app_port
  health_check_path  = var.health_check_path
  
  tags = local.common_tags
  
  depends_on = [module.networking]
}

# Database Infrastructure
module "database" {
  source = "./modules/database"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  # Networking
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  
  # Database configuration
  instance_class          = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  max_allocated_storage  = var.db_max_allocated_storage
  multi_az              = var.db_multi_az
  backup_retention_period = var.db_backup_retention_period
  
  # Security
  allowed_security_groups = [module.compute.app_security_group_id]
  
  tags = local.common_tags
  
  depends_on = [module.networking]
}

# Storage Infrastructure
module "storage" {
  source = "./modules/storage"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  # S3 configuration
  versioning_enabled = var.s3_versioning_enabled
  
  # CloudFront configuration
  price_class = var.cloudfront_price_class
  
  tags = local.common_tags
}

# Monitoring and Logging
module "monitoring" {
  source = "./modules/monitoring"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  # Resources to monitor
  auto_scaling_group_name = module.compute.auto_scaling_group_name
  load_balancer_arn      = module.compute.load_balancer_arn
  rds_instance_id        = module.database.rds_instance_id
  
  # CloudWatch configuration
  log_retention_days = var.log_retention_days
  
  # SNS for alerts
  alert_email = var.alert_email
  
  tags = local.common_tags
  
  depends_on = [module.compute, module.database]
}

# Security - Secrets Manager
resource "aws_secretsmanager_secret" "app_secrets" {
  name_prefix             = "${local.name_prefix}-app-secrets"
  description            = "Application secrets for Receipt Vault Pro"
  recovery_window_in_days = 7
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    database_url        = "postgresql://${module.database.rds_username}:${module.database.rds_password}@${module.database.rds_endpoint}:5432/${module.database.rds_database_name}"
    redis_url          = "redis://${module.database.redis_endpoint}:6379"
    jwt_secret         = random_password.jwt_secret.result
    workos_api_key     = var.workos_api_key
    workos_client_id   = var.workos_client_id
    workos_cookie_password = random_password.workos_cookie.result
  })
}

# Generate secure random passwords
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "random_password" "workos_cookie" {
  length  = 32
  special = false
}

# IAM Role for EC2 instances
resource "aws_iam_role" "app_role" {
  name_prefix = "${local.name_prefix}-app-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_iam_role_policy" "app_policy" {
  name_prefix = "${local.name_prefix}-app-policy"
  role        = aws_iam_role.app_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.app_secrets.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${module.storage.s3_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "app_profile" {
  name_prefix = "${local.name_prefix}-app-profile"
  role        = aws_iam_role.app_role.name
  
  tags = local.common_tags
}