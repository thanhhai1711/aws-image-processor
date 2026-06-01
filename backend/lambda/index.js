const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, PutItemCommand }               = require('@aws-sdk/client-dynamodb');
const { SNSClient, PublishCommand }                    = require('@aws-sdk/client-sns');
const sharp = require('sharp');

const s3     = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const sns    = new SNSClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });

exports.handler = async (event) => {
    const bucketName = event.Records[0].s3.bucket.name;
    const objectKey  = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const imageId    = objectKey;

    try {
        console.log(`Bắt đầu xử lý ảnh: ${objectKey}`);

        // 1. Tải ảnh gốc + metadata từ Bucket A
        const response         = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: objectKey }));
        const imageBuffer      = await streamToBuffer(response.Body);
        const fileSizeOriginal = event.Records[0].s3.object.size;

        // 2. Đọc tùy chọn từ metadata (Hải gắn vào qua server.js)
        const meta         = response.Metadata || {};
        const isResize     = meta['resize']    === 'true';
        const isWatermark  = meta['watermark'] === 'true';
        const isConvert    = meta['convert']   === 'true';
        const format       = (meta['format']   || 'webp').toLowerCase();
        const email        = meta['email']     || '';
        const originalName = meta['originalname'] || objectKey.split('/').pop();

        console.log('Tùy chọn:', { isResize, isWatermark, isConvert, format });

        // 3. Xử lý ảnh bằng sharp
        let imagePipeline = sharp(imageBuffer);

        if (isResize) {
            imagePipeline = imagePipeline.resize({ width: 1200, withoutEnlargement: true });
        }

        if (isWatermark) {
            const { width, height } = await sharp(imageBuffer).metadata();
            const wmWidth  = Math.min(200, Math.floor(width  * 0.3));
            const wmHeight = Math.min(50,  Math.floor(height * 0.08));
            const fontSize = Math.max(12, Math.floor(wmHeight * 0.6));

            const svgWatermark = Buffer.from(`
                <svg width="${wmWidth}" height="${wmHeight}">
                    <text x="5" y="${Math.floor(wmHeight * 0.75)}" 
                        font-size="${fontSize}" 
                        font-family="Arial" 
                        fill="white" 
                        opacity="0.6">© Đề tài 6</text>
                </svg>`);

            imagePipeline = imagePipeline.composite([{
                input: svgWatermark,
                gravity: 'southeast',
            }]);
}

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
        const BUCKET_B     = process.env.BUCKET_B_NAME;
        const baseName     = objectKey.substring(0, objectKey.lastIndexOf('.'));
        const newObjectKey = `processed/${baseName}.${finalExtension}`;

        await s3.send(new PutObjectCommand({
            Bucket:      BUCKET_B,
            Key:         newObjectKey,
            Body:        processedImageBuffer,
            ContentType: finalContentType,
        }));

        console.log(`✅ Lưu Bucket B: s3://${BUCKET_B}/${newObjectKey}`);

        // 5. Ghi metadata vào DynamoDB (thành viên 3)
        await dynamo.send(new PutItemCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
                ImageId:           { S: imageId },
                originalName:      { S: originalName },
                sourceUrl:         { S: `s3://${bucketName}/${objectKey}` },
                processedUrl:      { S: `s3://${BUCKET_B}/${newObjectKey}` },
                sizeBytes:         { N: String(processedImageBuffer.length) },
                originalSizeBytes: { N: String(fileSizeOriginal) },
                status:            { S: 'PROCESSED' },
                processedAt:       { S: new Date().toISOString() },
                email:             { S: email },
                options:           { S: JSON.stringify({ resize: isResize, watermark: isWatermark, convert: isConvert, format }) },
            },
        }));

        console.log(`✅ Ghi DynamoDB: ImageId=${imageId}`);

        // ════════════════════════════════════════════════
        // 6. GỬI THÔNG BÁO SNS (thành viên 4)
        // SNS_TOPIC_ARN set trong Lambda env variables
        // ════════════════════════════════════════════════
        if (email) {
            // Gửi email cho người dùng biết ảnh xử lý xong
            await sns.send(new PublishCommand({
                TopicArn: process.env.SNS_TOPIC_ARN,
                Subject:  '✅ Ảnh của bạn đã được xử lý xong!',
                Message:  [
                    `Xin chào!`,
                    ``,
                    `Ảnh "${originalName}" đã được xử lý thành công.`,
                    ``,
                    `Chi tiết:`,
                    `- Thao tác: ${[isResize && 'Resize', isWatermark && 'Watermark', isConvert && `Convert → ${format}`].filter(Boolean).join(', ')}`,
                    `- Dung lượng gốc : ${(fileSizeOriginal / 1024).toFixed(1)} KB`,
                    `- Dung lượng sau  : ${(processedImageBuffer.length / 1024).toFixed(1)} KB`,
                    `- Đường dẫn ảnh  : s3://${BUCKET_B}/${newObjectKey}`,
                    `- Thời gian       : ${new Date().toLocaleString('vi-VN')}`,
                    ``,
                    `Trân trọng,`,
                    `Hệ thống xử lý ảnh - Nhóm 6`,
                ].join('\n'),
                MessageAttributes: {
                    email: {
                        DataType:    'String',
                        StringValue: email,
                    },
                },
            }));

            console.log(`✅ Gửi SNS thành công đến: ${email}`);
        }

        return { statusCode: 200, body: JSON.stringify({ key: newObjectKey, imageId }) };

    } catch (error) {
        console.error('❌ Lambda lỗi:', error);

        // Ghi FAILED vào DynamoDB để dễ debug
        try {
            await dynamo.send(new PutItemCommand({
                TableName: process.env.TABLE_NAME,
                Item: {
                    ImageId:     { S: imageId },
                    status:      { S: 'FAILED' },
                    errorMsg:    { S: error.message },
                    processedAt: { S: new Date().toISOString() },
                },
            }));
        } catch (dbErr) {
            console.error('❌ Ghi lỗi DynamoDB thất bại:', dbErr.message);
        }

        throw error; // SQS retry → sau 3 lần → DLQ
    }
};

const streamToBuffer = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data',  (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end',   () => resolve(Buffer.concat(chunks)));
    });
// ── Gallery ──
async function openGallery() {
    document.getElementById('gallerySection').style.display = 'block';
    document.getElementById('galleryGrid').innerHTML = '<p style="color:var(--muted)">Đang tải...</p>';

try {
    const res = await fetch('http://localhost:3000/api/images');
    const { images } = await res.json();

    if (!images.length) {
        document.getElementById('galleryGrid').innerHTML = '<p style="color:var(--muted)">Chưa có ảnh nào được xử lý</p>';
        return;
    }

    document.getElementById('galleryGrid').innerHTML = images.map(img => `
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden;">
        <img src="${img.processedUrl}" style="width:100%; aspect-ratio:1; object-fit:cover;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%2250%25%22 font-size=%2240%22>🖼️</text></svg>'"/>
        <div style="padding:10px;">
        <div style="font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${img.originalName}</div>
        <div style="font-size:11px; color:var(--muted); margin-top:4px;">${(img.sizeBytes/1024).toFixed(1)} KB</div>
        <div style="font-size:11px; color:var(--muted);">${new Date(img.processedAt).toLocaleString('vi-VN')}</div>
        <a href="${img.processedUrl}" download style="display:block; margin-top:8px; text-align:center; padding:6px; background:rgba(124,107,255,.1); border:1px solid rgba(124,107,255,.3); border-radius:6px; color:var(--accent); font-size:11px; text-decoration:none;">⬇️ Tải về</a>
        </div>
    </div>
    `).join('');

} catch (err) {
    document.getElementById('galleryGrid').innerHTML = `<p style="color:var(--danger)">Lỗi: ${err.message}</p>`;
}
}

function closeGallery() {
    document.getElementById('gallerySection').style.display = 'none';
}