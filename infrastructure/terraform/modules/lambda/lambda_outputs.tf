output "function_name" {
  value = aws_lambda_function.image_processor.function_name
}

output "function_arn" {
  value = aws_lambda_function.image_processor.arn
}

output "s3_permission_id" {
  description = "ID của lambda_permission — s3 module dùng để depends_on"
  value       = aws_lambda_permission.s3_invoke.id
}
