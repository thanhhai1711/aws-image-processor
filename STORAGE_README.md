# Hướng dẫn kết nối Hạ tầng (S3 & DynamoDB) - Thành viên 3

### 1. Thông tin S3 Buckets
* **Bucket Ảnh gốc (A):** Đã bật cấu hình CORS (cho phép PUT, POST, GET từ mọi nguồn). Thành viên 1 (Frontend) có thể dùng để tạo Presigned URL upload ảnh trực tiếp.
* **Bucket Ảnh đã xử lý (B):** Nơi lưu kết quả sau khi Lambda xử lý xong.

### 2. Cấu trúc Bảng DynamoDB (`ImageMetadata`)
* **Khóa chính (Partition Key):** `ImageId` (Kiểu dữ liệu: String / Ký tự)
* **Cấu trúc dữ liệu mẫu (Dành cho Thành viên 2 - Lambda ghi dữ liệu):**

```json
{
  "ImageId": "uuid-chuoi-ky-tu-ngau-nhien",
  "originalName": "ten_anh_goc.png",
  "sourceUrl": "s3://ten-bucket-goc/ten_anh_goc.png",
  "processedUrl": "s3://ten-bucket-da-xu-ly/ten_anh_da_xu_ly.webp",
  "sizeBytes": 1048576,
  "status": "PROCESSED",
  "updatedAt": "2026-05-25T15:00:00Z"
}
