

Hệ thống xử lý ảnh tự động trên nền tảng Cloud AWS. Khi người dùng upload ảnh, hệ thống tự động nhận diện, resize, gắn watermark, lưu trữ và gửi thông báo.

## 🏗 Kiến trúc hệ thống
1. **Frontend:** Upload ảnh trực tiếp lên S3 bằng Presigned URL (không qua server).
2. **Storage:** Amazon S3 (Bucket A chứa ảnh gốc, Bucket B chứa ảnh đã xử lý).
3. **Processing:** S3 Event trigger SQS -> kích hoạt Lambda Function (dùng thư viện `sharp`).
4. **Database:** DynamoDB lưu siêu dữ liệu (metadata) của ảnh.
5. **Notification & Error Handling:** SNS gửi thông báo hoàn tất, SQS Dead Letter Queue (DLQ) gom các file lỗi.

---

## 👥 Phân công nhiệm vụ (Team 4 người)

- **Thành viên 1 - Hải (Leader):** Xây dựng giao diện Frontend (HTML/JS) và API tạo Presigned URL. Nhánh: `feature/frontend`
- **Thành viên 2:** Viết logic Lambda Function xử lý ảnh (Resize, Watermark, WebP). Nhánh: `feature/lambda-processing`
- **Thành viên 3:** Cấu hình hạ tầng S3 Buckets và bảng DynamoDB. Nhánh: `feature/storage-db`
- **Thành viên 4:** Thiết lập hàng đợi SQS, DLQ xử lý lỗi và hệ thống thông báo SNS. Nhánh: `feature/sns-sqs`

---

## ⚔️ Luật chơi của Team (BẮT BUỘC ĐỌC)

Để tránh ăn đấm vì conflict code, toàn team tuân thủ quy trình sau:

1. **Tuyệt đối KHÔNG code và KHÔNG push thẳng lên nhánh `main`.**
2. **Mỗi sáng trước khi làm việc:** 
```bash
   git checkout develop
   git pull origin develop



   git checkout -b tên nhánh