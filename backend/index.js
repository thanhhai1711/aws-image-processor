const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-1' });

exports.handler = async (event) => {
    try {
        const bucketName = event.Records[0].s3.bucket.name;
        const objectKey  = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

        console.log(`Bắt đầu xử lý ảnh: ${objectKey}`);

        // 1. Tải ảnh gốc + metadata từ Bucket A
        const response    = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: objectKey }));
        const imageBuffer = await streamToBuffer(response.Body);

        // 2. Bóc tách yêu cầu từ frontend (thằng Hải truyền lên qua server.js)
        // AWS tự động lowercase key metadata: resize, watermark, convert, format
        const meta        = response.Metadata || {};
        const isResize    = meta['resize']    === 'true';
        const isWatermark = meta['watermark'] === 'true';
        const isConvert   = meta['convert']   === 'true';
        const format      = (meta['format']   || 'webp').toLowerCase(); // jpg|png|webp|avif

        console.log('Tùy chọn từ giao diện:', { isResize, isWatermark, isConvert, format });

        // 3. Xử lý ảnh bằng sharp (pipeline)
        let imagePipeline = sharp(imageBuffer);

        // Resize — tối đa 1200px, không phóng to ảnh nhỏ
        if (isResize) {
            imagePipeline = imagePipeline.resize({ width: 1200, withoutEnlargement: true });
        }

        // Watermark — chữ chìm góc phải bên dưới
        if (isWatermark) {
            const svgWatermark = `
                <svg width="300" height="100">
                    <text x="10" y="40" font-size="25" fill="white" opacity="0.6">Bản quyền của Nhóm 6</text>
                </svg>`;
            imagePipeline = imagePipeline.composite([{
                input: Buffer.from(svgWatermark),
                gravity: 'southeast',
            }]);
        }

        // Convert — đọc đúng format frontend chọn (jpg/png/webp/avif)
        let finalContentType = response.ContentType || 'image/jpeg';
        let finalExtension   = objectKey.split('.').pop();

        if (isConvert) {
            const formatMap = {
                jpg:  { fn: () => imagePipeline.jpeg({ quality: 85 }), mime: 'image/jpeg', ext: 'jpg'  },
                jpeg: { fn: () => imagePipeline.jpeg({ quality: 85 }), mime: 'image/jpeg', ext: 'jpg'  },
                png:  { fn: () => imagePipeline.png(),                  mime: 'image/png',  ext: 'png'  },
                webp: { fn: () => imagePipeline.webp({ quality: 80 }), mime: 'image/webp', ext: 'webp' },
                avif: { fn: () => imagePipeline.avif({ quality: 80 }), mime: 'image/avif', ext: 'avif' },
            };
            const chosen     = formatMap[format] || formatMap['webp'];
            imagePipeline    = chosen.fn();
            finalContentType = chosen.mime;
            finalExtension   = chosen.ext;
        }

        const processedImageBuffer = await imagePipeline.toBuffer();

        // 4. Lưu ảnh đã xử lý vào Bucket B
        // BUCKET_B_NAME set trong Lambda Console → Configuration → Environment variables
        const BUCKET_B     = process.env.BUCKET_B_NAME;
        const baseName     = objectKey.substring(0, objectKey.lastIndexOf('.'));
        const newObjectKey = `processed/${baseName}.${finalExtension}`; // vd: processed/uploads/123-anh.webp

        await s3.send(new PutObjectCommand({
            Bucket:      BUCKET_B,
            Key:         newObjectKey,
            Body:        processedImageBuffer,
            ContentType: finalContentType,
        }));

        console.log(`✅ Xử lý thành công! Đã lưu: s3://${BUCKET_B}/${newObjectKey}`);

        // TODO (thành viên 3): ghi metadata vào DynamoDB tại đây
        // TODO (thành viên 4): gửi SNS notification tại đây

        return { statusCode: 200, body: JSON.stringify({ key: newObjectKey }) };

    } catch (error) {
        console.error('❌ Lambda lỗi:', error);
        throw error; // ném lỗi để SQS retry → sau 3 lần đẩy vào Dead Letter Queue
    }
};

// Helper: chuyển stream S3 thành Buffer
const streamToBuffer = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data',  (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end',   () => resolve(Buffer.concat(chunks)));
    });
