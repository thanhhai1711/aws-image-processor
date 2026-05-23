const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

// Khởi tạo S3 Client - Đổi lại region của nhóm mày nếu khác (ví dụ: ap-southeast-1 là Singapore)
const s3 = new S3Client({ region: 'ap-southeast-1' }); 

exports.handler = async (event) => {
    try {
        // 1. Nhận Event từ S3 (Cấu trúc chuẩn khi S3 Object Created kích hoạt Lambda)
        const bucketName = event.Records[0].s3.bucket.name; // Bucket A (Chứa ảnh gốc)
        const objectKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

        console.log(`Bắt đầu xử lý ảnh: ${objectKey} từ bucket: ${bucketName}`);

        // 2. Tải ảnh gốc từ Bucket A về dưới dạng Stream
        const getCommand = new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
        });
        const { Body } = await s3.send(getCommand);
        const imageBuffer = await streamToBuffer(Body);

        // 3. XỬ LÝ ẢNH VỚI SHARP (Resize và ép sang WebP theo yêu cầu đề tài)
        const processedImageBuffer = await sharp(imageBuffer)
            .resize({ width: 800 }) // Bóp chiều rộng về 800px, tự tính chiều cao để giữ đúng tỉ lệ ảnh
            .webp({ quality: 80 })  // Ép sang định dạng WebP với chất lượng 80% cho nhẹ
            .toBuffer();

        // 4. Đẩy ảnh thành phẩm lên Bucket B
        // !!! NHỚ HỎI THẰNG THÀNH VIÊN 3 XEM TÊN BUCKET ĐÍCH LÀ GÌ RỒI ĐỔI CHỮ DƯỚI NÀY !!!
        const destinationBucket = 'ten-bucket-b-cua-nhom-may'; 
        const newObjectKey = `processed-${objectKey.split('.')[0]}.webp`; // Đổi đuôi file thành .webp

        const putCommand = new PutObjectCommand({
            Bucket: destinationBucket,
            Key: newObjectKey,
            Body: processedImageBuffer,
            ContentType: 'image/webp',
        });
        await s3.send(putCommand);

        console.log(`Xử lý thành công! Đã lưu ảnh mới tại: ${newObjectKey}`);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Xử lý ảnh thành công!', key: newObjectKey }),
        };

    } catch (error) {
        console.error("Toang rồi ông giáo ạ, lỗi ở Lambda:", error);
        // Bắt buộc phải throw error ở đây để AWS nhận diện hàm bị lỗi, 
        // từ đó nó mới tự động đá cái event lỗi này vào Dead Letter Queue (DLQ) như thầy yêu cầu
        throw error; 
    }
};

// Hàm phụ trợ dùng Promise để biến S3 Stream thành Buffer cho thằng Sharp nó đọc được
const streamToBuffer = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });