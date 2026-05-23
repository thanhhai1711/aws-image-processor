// ===================================
// server.js — API tạo Presigned URL
// Thành viên: Hải (Leader)
// Nhánh: feature/frontend
// Chạy: node server.js  hoặc  npm run dev
// ===================================

require('dotenv').config();

const express               = require('express');
const cors                  = require('cors');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }      = require('@aws-sdk/s3-request-presigner');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── AWS S3 Client ──
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ── Middleware ──
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
  methods: ['GET', 'POST'],
}));

// ── Định dạng ảnh được phép upload ──
const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png',
  'image/webp', 'image/gif', 'image/heic', 'image/avif',
];

// ── Max 20MB ──
const MAX_SIZE = 20 * 1024 * 1024;

// ===================================
// GET /api/health
// Kiểm tra server sống không
// ===================================
app.get('/api/health', (req, res) => {
  res.json({
    status:   'ok',
    bucket_a: process.env.BUCKET_A_NAME,
    region:   process.env.AWS_REGION,
  });
});

// ===================================
// POST /api/presign
// Nhận thông tin file + metadata từ frontend
// Tạo presigned URL để frontend PUT thẳng lên S3 Bucket A
//
// Body:
// {
//   filename, contentType, fileSize,
//   resize, watermark, convert,   ← 'true' / 'false'
//   format,                        ← 'jpg' | 'png' | 'webp' | 'avif'
//   email
// }
//
// Response:
// { presignedUrl, key, expiresIn }
// ===================================
app.post('/api/presign', async (req, res) => {
  try {
    const {
      filename,
      contentType,
      fileSize,
      resize    = 'true',
      watermark = 'true',
      convert   = 'true',
      format    = 'webp',
      email     = '',
    } = req.body;

    // ── Validation ──
    if (!filename || !contentType) {
      return res.status(400).json({ error: 'Thiếu filename hoặc contentType' });
    }
    if (!ALLOWED_TYPES.includes(contentType.toLowerCase())) {
      return res.status(400).json({ error: `Định dạng không hỗ trợ: ${contentType}` });
    }
    if (fileSize && fileSize > MAX_SIZE) {
      return res.status(400).json({ error: 'File quá lớn, tối đa 20MB' });
    }

    // ── Tạo key duy nhất ──
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key      = `uploads/${Date.now()}-${safeName}`;

    // ── PutObjectCommand kèm Metadata ──
    // Lambda đọc các metadata này qua response.Metadata
    const command = new PutObjectCommand({
      Bucket:      process.env.BUCKET_A_NAME,
      Key:         key,
      ContentType: contentType,
      Metadata: {
        resize:       resize.toString(),
        watermark:    watermark.toString(),
        convert:      convert.toString(),
        format:       format.toLowerCase(),
        email:        email,
        originalname: safeName,
      },
    });

    // ── Ký URL, hết hạn sau 5 phút ──
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    console.log(`✅ Presigned URL tạo xong: ${key}`);
    res.json({ presignedUrl, key, expiresIn: 300 });

  } catch (err) {
    console.error('❌ Lỗi tạo presigned URL:', err.message);
    res.status(500).json({ error: 'Không thể tạo presigned URL', detail: err.message });
  }
});

// ===================================
// Khởi động server
// ===================================
app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
  console.log(`   Bucket A : ${process.env.BUCKET_A_NAME}`);
  console.log(`   Region   : ${process.env.AWS_REGION}`);
  console.log(`   CORS     : ${process.env.FRONTEND_URL || 'http://127.0.0.1:5500'}`);
});
