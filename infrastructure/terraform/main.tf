# ===================================
# main.tf — Toàn bộ hạ tầng AWS
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

# ══════════════════════════════════════
# 1. S3 BUCKET A — nhận ảnh gốc
# ══════════════════════════════════════
resource "aws_s3_bucket" "bucket_a" {
  bucket = "${var.project_name}-source-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_cors_configuration" "bucket_a_cors" {
  bucket = aws_s3_bucket.bucket_a.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

# Trigger S3 → Lambda khi có file mới trong uploads/
resource "aws_s3_bucket_notification" "bucket_a_trigger" {
  bucket = aws_s3_bucket.bucket_a.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.image_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
  }

  depends_on = [aws_lambda_permission.s3_invoke]
}

# ══════════════════════════════════════
# 2. S3 BUCKET B — lưu ảnh đã xử lý
# ══════════════════════════════════════
resource "aws_s3_bucket" "bucket_b" {
  bucket = "${var.project_name}-processed-${data.aws_caller_identity.current.account_id}"
}

# ══════════════════════════════════════
# 3. DYNAMODB — lưu metadata ảnh
# ══════════════════════════════════════
resource "aws_dynamodb_table" "image_metadata" {
  name         = "${var.project_name}-ImageMetadata"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "ImageId"

  attribute {
    name = "ImageId"
    type = "S"
  }
}

# ══════════════════════════════════════
# 4. SQS DEAD LETTER QUEUE
# ══════════════════════════════════════
resource "aws_sqs_queue" "dlq" {
  name                      = "${var.project_name}-dlq"
  message_retention_seconds = 604800  # 7 ngày
}

# ══════════════════════════════════════
# 5. SQS QUEUE chính
# Lambda lỗi → retry 3 lần → DLQ
# ══════════════════════════════════════
resource "aws_sqs_queue" "main_queue" {
  name                       = "${var.project_name}-queue"
  visibility_timeout_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}

# ══════════════════════════════════════
# 6. SNS TOPIC — gửi email thông báo
# ══════════════════════════════════════
resource "aws_sns_topic" "notifications" {
  name = "${var.project_name}-notifications"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.notifications.arn
  protocol  = "email"
  endpoint  = var.admin_email
}

# ══════════════════════════════════════
# 7. IAM ROLE cho Lambda
# ══════════════════════════════════════
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# Cấp quyền Lambda đọc/ghi S3, DynamoDB, SNS, SQS, CloudWatch
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Đọc ảnh từ Bucket A
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.bucket_a.arn}/*"
      },
      {
        # Ghi ảnh vào Bucket B
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.bucket_b.arn}/*"
      },
      {
        # Ghi/đọc DynamoDB
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.image_metadata.arn
      },
      {
        # Gửi SNS notification
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = aws_sns_topic.notifications.arn
      },
      {
        # Ghi log vào CloudWatch
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        # Đọc/xóa message từ SQS
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = aws_sqs_queue.main_queue.arn
      }
    ]
  })
}

# ══════════════════════════════════════
# 8. LAMBDA FUNCTION
# ══════════════════════════════════════

# Zip code Lambda trước khi upload
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "../../backend/lambda"
  output_path = "${path.module}/lambda.zip"
  excludes    = [
    "package-lock.json",
    "node_modules/.bin",
    ".npmrc"
  ]
}

resource "aws_lambda_function" "image_processor" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-function"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 300   # 5 phút — đủ để xử lý ảnh lớn
  memory_size      = 1024  # 1GB RAM cho sharp

  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  # Biến môi trường Lambda đọc
  environment {
  variables = {
    BUCKET_B_NAME = aws_s3_bucket.bucket_b.bucket
    TABLE_NAME    = aws_dynamodb_table.image_metadata.name
    SNS_TOPIC_ARN = aws_sns_topic.notifications.arn
  }
}
}

# Cấp quyền S3 gọi Lambda
resource "aws_lambda_permission" "s3_invoke" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.image_processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.bucket_a.arn
}

# ══════════════════════════════════════
# Data sources
# ══════════════════════════════════════
data "aws_caller_identity" "current" {}
