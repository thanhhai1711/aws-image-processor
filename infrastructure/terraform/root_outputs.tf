# ===================================
# outputs.tf — In ra sau khi terraform apply xong
# Dùng các giá trị này điền vào backend/api/.env
# ===================================

output "bucket_a_name" {
  description = "Điền vào BUCKET_A_NAME trong backend/api/.env"
  value       = module.s3.bucket_a_name
}

output "bucket_b_name" {
  description = "Tên Bucket B (tự động điền vào Lambda env)"
  value       = module.s3.bucket_b_name
}

output "dynamodb_table_name" {
  description = "Tên bảng DynamoDB"
  value       = module.dynamodb.table_name
}

output "sqs_queue_url" {
  description = "URL SQS Queue chính"
  value       = module.messaging.sqs_queue_url
}

output "dlq_url" {
  description = "URL Dead Letter Queue — vào đây xem message lỗi"
  value       = module.messaging.dlq_url
}

output "sns_topic_arn" {
  description = "ARN SNS Topic"
  value       = module.messaging.sns_topic_arn
}

output "lambda_function_name" {
  description = "Tên Lambda Function"
  value       = module.lambda.function_name
}
