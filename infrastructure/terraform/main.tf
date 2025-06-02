# Enterprise Infrastructure as Code - Receipt Vault Pro
# Multi-environment, security-hardened Terraform configuration

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "~> 3.15"
    }
  }

  backend "s3" {
    # Backend configuration will be provided via backend config files
    # terraform init -backend-config=environments/prod/backend.hcl
  }
}

# Local variables for environment-specific configuration
locals {
  environment = var.environment
  project     = "receipt-vault"
  
  common_tags = {
    Project     = local.project
    Environment = local.environment
    ManagedBy   = "terraform"
    Owner       = "platform-team"
    CostCenter  = "engineering"
  }

  # Security configuration
  allowed_cidr_blocks = var.environment == "prod" ? var.prod_allowed_cidrs : var.dev_allowed_cidrs
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# VPC Configuration with security best practices
module "vpc" {
  source = "./modules/vpc"
  
  environment = local.environment
  project     = local.project
  
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  private_subnet_cidrs = var.private_subnet_cidrs
  public_subnet_cidrs  = var.public_subnet_cidrs
  
  enable_nat_gateway   = true
  enable_vpn_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  # Security groups
  enable_flow_logs = true
  
  tags = local.common_tags
}

# EKS Cluster with security hardening
module "eks" {
  source = "./modules/eks"
  
  environment = local.environment
  project     = local.project
  
  cluster_name    = "${local.project}-${local.environment}"
  cluster_version = var.kubernetes_version
  
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  
  # Security configuration
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = var.environment == "prod" ? false : true
  cluster_endpoint_public_access_cidrs = local.allowed_cidr_blocks
  
  # Node groups configuration
  node_groups = var.node_groups
  
  # Add-ons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }
  
  # Enable logging
  cluster_enabled_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  
  tags = local.common_tags
}

# RDS PostgreSQL with high availability
module "database" {
  source = "./modules/rds"
  
  environment = local.environment
  project     = local.project
  
  identifier = "${local.project}-${local.environment}"
  
  engine         = "postgres"
  engine_version = var.postgres_version
  instance_class = var.db_instance_class
  
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_encrypted     = true
  
  db_name  = "receipt_vault"
  username = "postgres"
  
  # Security configuration
  vpc_security_group_ids = [module.security_groups.database_sg_id]
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  
  backup_retention_period = var.environment == "prod" ? 30 : 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  # Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn
  
  # Performance Insights
  performance_insights_enabled = true
  performance_insights_retention_period = var.environment == "prod" ? 731 : 7
  
  deletion_protection = var.environment == "prod" ? true : false
  
  tags = local.common_tags
}

# Redis for caching with clustering
module "redis" {
  source = "./modules/elasticache"
  
  environment = local.environment
  project     = local.project
  
  cluster_id         = "${local.project}-${local.environment}-redis"
  node_type          = var.redis_node_type
  num_cache_nodes    = var.redis_num_nodes
  parameter_group    = "default.redis7"
  port              = 6379
  
  subnet_group_name       = module.vpc.elasticache_subnet_group_name
  security_group_ids      = [module.security_groups.redis_sg_id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  tags = local.common_tags
}

# Security Groups
module "security_groups" {
  source = "./modules/security-groups"
  
  environment = local.environment
  project     = local.project
  
  vpc_id = module.vpc.vpc_id
  
  allowed_cidr_blocks = local.allowed_cidr_blocks
  
  tags = local.common_tags
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"
  
  environment = local.environment
  project     = local.project
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.public_subnet_ids
  
  security_group_ids = [module.security_groups.alb_sg_id]
  
  # SSL configuration
  certificate_arn = var.ssl_certificate_arn
  
  # WAF
  enable_waf = var.environment == "prod" ? true : false
  
  tags = local.common_tags
}

# S3 Buckets for file storage
module "s3" {
  source = "./modules/s3"
  
  environment = local.environment
  project     = local.project
  
  # Receipt storage bucket
  receipts_bucket_name = "${local.project}-${local.environment}-receipts-${random_id.bucket_suffix.hex}"
  
  # Backup bucket
  backups_bucket_name = "${local.project}-${local.environment}-backups-${random_id.bucket_suffix.hex}"
  
  # Security configuration
  enable_versioning = true
  enable_encryption = true
  
  # Lifecycle policies
  enable_lifecycle_policy = true
  
  tags = local.common_tags
}

# Random ID for bucket naming
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# IAM roles and policies
module "iam" {
  source = "./modules/iam"
  
  environment = local.environment
  project     = local.project
  
  eks_cluster_name = module.eks.cluster_name
  s3_bucket_arns   = [module.s3.receipts_bucket_arn, module.s3.backups_bucket_arn]
  
  tags = local.common_tags
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "application_logs" {
  name              = "/aws/eks/${module.eks.cluster_name}/application"
  retention_in_days = var.environment == "prod" ? 30 : 7
  
  tags = local.common_tags
}

# Enhanced monitoring role for RDS
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "${local.project}-${local.environment}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = module.database.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = module.redis.endpoint
  sensitive   = true
}

output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = module.alb.dns_name
}

output "s3_receipts_bucket" {
  description = "Name of the receipts S3 bucket"
  value       = module.s3.receipts_bucket_name
}