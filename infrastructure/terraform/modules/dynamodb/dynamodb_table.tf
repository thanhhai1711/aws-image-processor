# ===================================
# modules/dynamodb/main.tf
# Bảng lưu metadata ảnh sau khi xử lý
# ===================================

resource "aws_dynamodb_table" "image_metadata" {
  name         = "${var.project_name}-ImageMetadata"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "ImageId"

  attribute {
    name = "ImageId"
    type = "S"
  }
}
