# Compute Module Variables

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for load balancer"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for application instances"
  type        = list(string)
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "key_name" {
  description = "AWS Key Pair name"
  type        = string
}

variable "min_size" {
  description = "Minimum instances in ASG"
  type        = number
  default     = 2
}

variable "max_size" {
  description = "Maximum instances in ASG"
  type        = number
  default     = 10
}

variable "desired_capacity" {
  description = "Desired instances in ASG"
  type        = number
  default     = 2
}

variable "app_port" {
  description = "Application port"
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "Health check path"
  type        = string
  default     = "/health"
}

variable "instance_profile_name" {
  description = "IAM instance profile name"
  type        = string
}

variable "secrets_arn" {
  description = "ARN of secrets manager secret"
  type        = string
}

variable "log_group_name" {
  description = "CloudWatch log group name"
  type        = string
}

variable "enable_ssl" {
  description = "Enable SSL/HTTPS"
  type        = bool
  default     = true
}

variable "ssl_certificate_arn" {
  description = "SSL certificate ARN"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}