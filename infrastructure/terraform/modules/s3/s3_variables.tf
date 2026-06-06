variable "project_name" {
  description = "Prefix cho tên bucket"
  type        = string
}

variable "account_id" {
  description = "AWS Account ID — dùng làm suffix bucket name cho unique"
  type        = string
}

variable "lambda_function_arn" {
  description = "ARN của Lambda Function để gắn S3 trigger"
  type        = string
}

variable "lambda_permission_id" {
  description = "ID của aws_lambda_permission — đảm bảo permission tạo trước trigger"
  type        = string
}
