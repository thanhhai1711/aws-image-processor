const sharp = require('sharp');

async function testXuLyAnh() {
    try {
        console.log("Đang tiến hành bóp ảnh...");
        // Lấy file input.jpg trên máy, bóp chiều rộng xuống 800px, ép thành webp
        await sharp('input.jpg')
            .resize({ width: 800 })
            .webp({ quality: 80 })
            .toFile('output.webp');
            
        console.log("Ngon lành cành đào! Đã ép xong ra file output.webp");
    } catch (error) {
        console.error("Toang cmnr ông giáo ạ, lỗi đây:", error);
    }
}

testXuLyAnh();