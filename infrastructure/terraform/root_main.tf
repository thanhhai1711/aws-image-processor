# ===================================
# main.tf — Entry point
# Chạy: terraform init → terraform apply
# ===================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

# ── 1. Messaging (SQS + SNS) — không phụ thuộc gì, tạo trước ──
module "messaging" {
  source       = "./modules/messaging"
  project_name = var.project_name
  admin_email  = var.admin_email
}

# ── 2. DynamoDB — không phụ thuộc gì, tạo trước ──
module "dynamodb" {
  source       = "./modules/dynamodb"
  project_name = var.project_name
}

# ── 3. Lambda + IAM — cần ARN từ dynamodb và messaging ──
module "lambda" {
  source       = "./modules/lambda"
  project_name = var.project_name

  bucket_a_arn        = module.s3.bucket_a_arn
  bucket_b_arn        = module.s3.bucket_b_arn
  bucket_b_name       = module.s3.bucket_b_name
  dynamodb_table_arn  = module.dynamodb.table_arn
  dynamodb_table_name = module.dynamodb.table_name
  sns_topic_arn       = module.messaging.sns_topic_arn
  sqs_queue_arn       = module.messaging.sqs_queue_arn
}

# ── 4. S3 — cần ARN Lambda để gắn trigger ──
module "s3" {
  source       = "./modules/s3"
  project_name = var.project_name
  account_id   = data.aws_caller_identity.current.account_id

  lambda_function_arn  = module.lambda.function_arn
  lambda_permission_id = module.lambda.s3_permission_id
}
