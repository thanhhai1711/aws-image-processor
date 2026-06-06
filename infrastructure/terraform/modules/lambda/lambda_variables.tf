variable "project_name" {
  description = "Prefix cho tên Lambda và IAM role"
  type        = string
}

variable "lambda_source_dir" {
  description = "Đường dẫn tới thư mục source code Lambda"
  type        = string
  default     = "../../backend/lambda"
}

variable "bucket_a_arn" {
  description = "ARN Bucket A — Lambda cần quyền GetObject"
  type        = string
}

variable "bucket_b_arn" {
  description = "ARN Bucket B — Lambda cần quyền PutObject"
  type        = string
}

variable "bucket_b_name" {
  description = "Tên Bucket B — truyền vào Lambda env var"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "ARN bảng DynamoDB"
  type        = string
}

variable "dynamodb_table_name" {
  description = "Tên bảng DynamoDB — truyền vào Lambda env var"
  type        = string
}

variable "sns_topic_arn" {
  description = "ARN SNS Topic — Lambda cần quyền Publish"
  type        = string
}

variable "sqs_queue_arn" {
  description = "ARN SQS Queue — Lambda cần quyền đọc/xóa message"
  type        = string
}
