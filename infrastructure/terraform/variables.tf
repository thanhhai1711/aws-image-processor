# ===================================
# variables.tf — Khai báo biến
# Giá trị điền trong terraform.tfvars
# ===================================

variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Tên project — dùng làm prefix cho tất cả resource"
  type        = string
  default     = "image-processor"
}

variable "admin_email" {
  description = "Email nhận thông báo SNS khi ảnh xử lý xong"
  type        = string
}
