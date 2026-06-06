# ===================================
# modules/s3/main.tf
# Tạo Bucket A (ảnh gốc) và Bucket B (ảnh đã xử lý)
# Trigger S3 → Lambda được gắn sau khi Lambda tồn tại
# ===================================

resource "aws_s3_bucket" "bucket_a" {
  bucket = "${var.project_name}-source-${var.account_id}"
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
    lambda_function_arn = var.lambda_function_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
  }

  depends_on = [var.lambda_permission_id]
}

resource "aws_s3_bucket" "bucket_b" {
  bucket = "${var.project_name}-processed-${var.account_id}"
}
