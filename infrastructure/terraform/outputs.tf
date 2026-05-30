# ===================================
# outputs.tf — In ra sau khi terraform apply xong
# Dùng các giá trị này điền vào backend/api/.env
# ===================================

output "bucket_a_name" {
  description = "Điền vào BUCKET_A_NAME trong backend/api/.env"
  value       = aws_s3_bucket.bucket_a.bucket
}

output "bucket_b_name" {
  description = "Điền vào BUCKET_B_NAME trong Lambda env (tự động rồi)"
  value       = aws_s3_bucket.bucket_b.bucket
}

output "dynamodb_table_name" {
  description = "Tên bảng DynamoDB (tự động điền vào Lambda env)"
  value       = aws_dynamodb_table.image_metadata.name
}

output "sqs_queue_url" {
  description = "URL SQS Queue chính"
  value       = aws_sqs_queue.main_queue.url
}

output "dlq_url" {
  description = "URL Dead Letter Queue — vào đây xem message lỗi"
  value       = aws_sqs_queue.dlq.url
}

output "sns_topic_arn" {
  description = "ARN SNS Topic (tự động điền vào Lambda env)"
  value       = aws_sns_topic.notifications.arn
}

output "lambda_function_name" {
  description = "Tên Lambda Function"
  value       = aws_lambda_function.image_processor.function_name
}
