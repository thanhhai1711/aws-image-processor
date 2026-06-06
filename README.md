# AWS Image Processor

Hệ thống xử lý ảnh tự động trên nền tảng Cloud AWS. Khi người dùng upload ảnh, hệ thống tự động resize, gắn watermark, chuyển đổi định dạng, lưu trữ và gửi thông báo.

## 🏗 Kiến trúc hệ thống

```
User Browser
    │
    │  POST /api/presign  (lấy Presigned URL)
    ▼
Backend API (Express)
    │
    │  PUT trực tiếp bằng Presigned URL (không qua server)
    ▼
S3 Bucket A (ảnh gốc — uploads/)
    │
    │  S3 ObjectCreated Event → trigger trực tiếp
    ▼
Lambda Function (Node.js 20, 1GB RAM)
    │   ├─ sharp: Resize (max 1200px)
    │   ├─ sharp: Watermark (SVG overlay)
    │   └─ sharp: Convert format (webp/jpg/png/avif)
    │
    ├──▶ S3 Bucket B (ảnh đã xử lý — processed/)
    ├──▶ DynamoDB (metadata: ImageId, status, URL, kích thước...)
    └──▶ SNS → Email thông báo cho người dùng
         │
         └─ Nếu Lambda lỗi → retry tối đa 3 lần → SQS Dead Letter Queue
```

**Luồng xử lý chi tiết:**
1. **Frontend:** Gọi API lấy Presigned URL, sau đó PUT ảnh thẳng lên S3 Bucket A (không đi qua server, giảm tải băng thông).
2. **Storage:** S3 Bucket A chứa ảnh gốc (`uploads/`), Bucket B chứa ảnh đã xử lý (`processed/`).
3. **Processing:** S3 ObjectCreated event trigger Lambda trực tiếp. Lambda dùng thư viện `sharp` xử lý resize, watermark, convert format.
4. **Database:** DynamoDB lưu metadata của ảnh (ImageId, originalName, sourceUrl, processedUrl, sizeBytes, status, processedAt).
5. **Notification:** SNS gửi email thông báo khi xử lý xong (nếu người dùng cung cấp email).
6. **Error Handling:** Lambda lỗi → throw error → SQS retry tối đa 3 lần → chuyển sang Dead Letter Queue để debug. Trạng thái `FAILED` cũng được ghi vào DynamoDB.

> **Lưu ý về SQS:** SQS Queue được provision sẵn trong Terraform để dùng làm buffer khi cần scale, nhưng trong kiến trúc hiện tại S3 trigger Lambda trực tiếp cho độ trễ thấp hơn. SQS DLQ vẫn hoạt động để nhận message lỗi sau 3 lần retry.

---

## 🛠 Dịch vụ AWS sử dụng

| Dịch vụ | Vai trò |
|---|---|
| S3 (Bucket A) | Nhận ảnh gốc từ người dùng qua Presigned URL |
| S3 (Bucket B) | Lưu ảnh đã qua xử lý |
| Lambda | Xử lý ảnh: resize, watermark, convert |
| DynamoDB | Lưu metadata và trạng thái xử lý |
| SNS | Gửi email thông báo cho người dùng |
| SQS + DLQ | Error handling, retry, lưu message lỗi |
| IAM | Phân quyền least-privilege cho Lambda |
| CloudWatch | Logs của Lambda |

---

## 👥 Phân công nhiệm vụ (Team 4 người)

- **Thành viên 1 - Hải (Leader):** Xây dựng giao diện Frontend (HTML/JS) và API tạo Presigned URL. Nhánh: `feature/frontend`
- **Thành viên 2:** Viết logic Lambda Function xử lý ảnh (Resize, Watermark, WebP). Nhánh: `feature/lambda-processing`
- **Thành viên 3:** Cấu hình hạ tầng S3 Buckets và bảng DynamoDB. Nhánh: `feature/storage-db`
- **Thành viên 4:** Thiết lập hàng đợi SQS, DLQ xử lý lỗi và hệ thống thông báo SNS. Nhánh: `feature/sns-sqs`

---

## 🚀 Hướng dẫn triển khai

### 1. Khởi tạo hạ tầng AWS bằng Terraform

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Điền aws_region, project_name, admin_email vào terraform.tfvars

terraform init
terraform apply
# Copy các output (bucket names, table name...) sang bước tiếp theo
```

### 2. Chạy Backend API

```bash
cd backend/api
cp env.example .env
# Điền AWS credentials và tên bucket từ output Terraform vào .env

npm install
npm run dev
# API chạy tại http://localhost:3000
```

### 3. Mở Frontend

Mở file `frontend/index.html` bằng Live Server (VS Code) hoặc bất kỳ HTTP server nào.

---

## 📁 Cấu trúc project

```
aws-image-processor/
├── frontend/               # Giao diện người dùng (HTML/CSS/JS)
│   ├── index.html
│   ├── css/
│   └── js/
├── backend/
│   ├── api/                # Express server — tạo Presigned URL, đọc DynamoDB
│   │   └── server.js
│   └── lambda/             # Lambda Function — xử lý ảnh bằng sharp
│       └── index.js
└── infrastructure/
    ├── terraform/          # IaC — toàn bộ hạ tầng AWS
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    └── sqs-sns.yaml        # CloudFormation template (tham khảo, không dùng chính)
```
---

## 📐 Architecture Diagram

![Architecture Diagram](./architecture-diagram.svg)
