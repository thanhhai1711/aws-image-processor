const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

// Khởi tạo S3 Client
const s3 = new S3Client({ region: 'ap-southeast-1' }); 

exports.handler = async (event) => {
    try {
        const bucketName = event.Records[0].s3.bucket.name; 
        const objectKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

        console.log(`Bắt đầu xử lý ảnh: ${objectKey}`);

        // 1. Tải ảnh gốc VÀ kèm theo METADATA từ S3
        const getCommand = new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
        });
        const response = await s3.send(getCommand);
        const imageBuffer = await streamToBuffer(response.Body);

        // 2. BÓC TÁCH YÊU CẦU TỪ FRONTEND (Thằng Hải truyền lên)
        // AWS tự động chuyển key metadata thành chữ thường, ví dụ: x-amz-meta-resize -> resize
        const meta = response.Metadata || {};
        const isResize = meta['resize'] === 'true';
        const isWatermark = meta['watermark'] === 'true';
        const isConvert = meta['convert'] === 'true';

        console.log("Tùy chọn từ giao diện:", { isResize, isWatermark, isConvert });

        // 3. NHÀO NẶN ẢNH BẰNG SHARP (Dùng kỹ thuật Pipeline)
        let imagePipeline = sharp(imageBuffer);

        // Nếu user tick vào ô Resize (Giao diện ghi: Tối đa 1200px)
        if (isResize) {
            // withoutEnlargement: true để lỡ ảnh nhỏ hơn 1200px thì không bị phóng to làm mờ ảnh
            imagePipeline = imagePipeline.resize({ width: 1200, withoutEnlargement: true });
        }

        // Nếu user tick vào ô Watermark (Đóng dấu)
        if (isWatermark) {
            // Tao làm tạm một cái chữ chìm mờ mờ ở góc phải (southeast)
            // Sau này nhóm mày có logo thì tải file logo lên Lambda rồi gọi file đó vào đây thay thế
            const svgWatermark = `
                <svg width="300" height="100">
                    <text x="10" y="40" font-size="25" fill="white" opacity="0.6">Bản quyền của Nhóm 6</text>
                </svg>`;
            const watermarkBuffer = Buffer.from(svgWatermark);
            imagePipeline = imagePipeline.composite([{ input: watermarkBuffer, gravity: 'southeast' }]);
        }

        // Mặc định giữ nguyên định dạng cũ
        let finalContentType = response.ContentType;
        let finalExtension = objectKey.split('.').pop(); // Lấy đuôi file cũ (vd: jpg)

        // Nếu user tick vào ô Convert (Chuyển đổi định dạng sang WebP)
        if (isConvert) {
            imagePipeline = imagePipeline.webp({ quality: 80 });
            finalContentType = 'image/webp';
            finalExtension = 'webp';
        }

        // Kết xuất ảnh ra bộ nhớ
        const processedImageBuffer = await imagePipeline.toBuffer();

        // 4. Đẩy ảnh thành phẩm lên Bucket B
        const destinationBucket = 'ten-bucket-b-cua-nhom-may'; // NHỚ SỬA TÊN BUCKET VÀO ĐÂY
        
        // Cắt bỏ đuôi file cũ, gắn đuôi file mới vào
        const baseName = objectKey.substring(0, objectKey.lastIndexOf('.'));
        const newObjectKey = `processed-${baseName}.${finalExtension}`;

        const putCommand = new PutObjectCommand({
            Bucket: destinationBucket,
            Key: newObjectKey,
            Body: processedImageBuffer,
            ContentType: finalContentType,
        });
        await s3.send(putCommand);

        console.log(`Xử lý thành công! Đã lưu: ${newObjectKey}`);
        return { statusCode: 200, body: 'Xong luồng Lambda!' };

    } catch (error) {
        console.error("Lỗi sấp mặt rồi:", error);
        throw error; 
    }
};

const streamToBuffer = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });