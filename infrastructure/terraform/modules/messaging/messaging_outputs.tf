output "sns_topic_arn" {
  value = aws_sns_topic.notifications.arn
}

output "sqs_queue_arn" {
  value = aws_sqs_queue.main_queue.arn
}

output "sqs_queue_url" {
  value = aws_sqs_queue.main_queue.url
}

output "dlq_url" {
  value = aws_sqs_queue.dlq.url
}

output "dlq_arn" {
  value = aws_sqs_queue.dlq.arn
}
