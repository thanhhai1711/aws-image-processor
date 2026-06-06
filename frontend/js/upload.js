// ===================================
// upload.js — Main upload handler & form controls
// Thành viên: Hải (Leader)
// Nhánh: feature/frontend
// ===================================

// ── Đổi URL này nếu backend chạy port khác ──
const CONFIG = {
  API_PRESIGN_URL: 'https://aws-image-processor-1.onrender.com/api/presign',
};

// ── DOM refs ──
const submitBtn   = document.getElementById('submitBtn');
const progSection = document.getElementById('progressSection');
const progFill    = document.getElementById('progFill');
const progLabel   = document.getElementById('progLabel');

// ── Processing options toggle ──
document.querySelectorAll('.option-card').forEach((card) => {
  card.addEventListener('click', () => {
    const opt = card.dataset.opt;
    if (state.selectedOpts.has(opt)) {
      state.selectedOpts.delete(opt);
      card.classList.remove('selected');
    } else {
      state.selectedOpts.add(opt);
      card.classList.add('selected');
    }
  });
});

// ── Output format toggle ──
document.querySelectorAll('.fmt-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fmt-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.outputFmt = btn.dataset.fmt;
  });
});

// ===================================
// uploadFileToS3()
// Bước 1: POST /api/presign → backend tạo presigned URL kèm metadata
// Bước 2: PUT file thẳng lên S3 Bucket A bằng presigned URL
// Lambda sẽ đọc metadata (resize/watermark/convert/format/email) từ S3 object
// ===================================
async function uploadFileToS3(file) {
  const email = document.getElementById('emailInput').value.trim();

  // Bước 1: Lấy presigned URL từ backend
  const presignRes = await fetch(CONFIG.API_PRESIGN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename:    file.name,
      contentType: file.type,
      fileSize:    file.size,
      // Metadata — server.js gắn vào S3 object, Lambda đọc từ đó
      resize:    state.selectedOpts.has('resize')    ? 'true' : 'false',
      watermark: state.selectedOpts.has('watermark') ? 'true' : 'false',
      convert:   state.selectedOpts.has('convert')   ? 'true' : 'false',
      format:    state.outputFmt.toLowerCase(),
      email:     email,
    }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.error || `Lỗi lấy presigned URL: ${presignRes.status}`);
  }

  const { presignedUrl, key } = await presignRes.json();

  // Bước 2: PUT file thẳng lên S3
  const uploadRes = await fetch(presignedUrl, {
    method: 'PUT',
    body:   file,
    headers: { 'Content-Type': file.type },
  });

  if (!uploadRes.ok) throw new Error(`Upload S3 thất bại: ${uploadRes.status}`);

  return key;
}

// ===================================
// handleUpload()
// Điều phối toàn bộ luồng upload + cập nhật UI pipeline
// ===================================
async function handleUpload() {
  if (!state.files.length) {
    showToast('Vui lòng chọn ít nhất 1 ảnh', 'error');
    return;
  }

  const email = document.getElementById('emailInput').value.trim();
  const count = state.files.length;

  submitBtn.disabled        = true;
  progSection.style.display = 'flex';
  progFill.style.width      = '0%';
  resetSteps();

  // ── Step 1: Upload thật lên Bucket A ──
  setStep(1, 'active');
  await animateProgress(0, 30, 600, `Đang upload ${count} ảnh lên Bucket A...`);

  try {
    // Upload song song tất cả file cùng lúc
    const uploadedKeys = await Promise.all(
      state.files.map((file) => uploadFileToS3(file))
    );
    console.log('✅ Uploaded keys:', uploadedKeys);
  } catch (err) {
    console.error('❌ Upload lỗi:', err);
    showToast(`Upload thất bại: ${err.message}`, 'error');
    submitBtn.disabled        = false;
    progSection.style.display = 'none';
    resetSteps();
    return;
  }

  setStep(1, 'done');
  state.stats.uploaded += count;
  state.stats.queue    += count;
  animateStatTo('stat-uploaded', state.stats.uploaded);
  animateStatTo('stat-queue',    state.stats.queue);

  // ── Step 2: Lambda trigger (S3 tự bắn event, không cần gọi thêm) ──
  setStep(2, 'active');
  await animateProgress(30, 50, 700, 'ObjectCreated event → kích hoạt Lambda...');
  await sleep(300);
  setStep(2, 'done');

  // ── Step 3: Xử lý ảnh ──
  setStep(3, 'active');
  const opts = [...state.selectedOpts].join(', ') || 'không có';
  await animateProgress(50, 75, 1200, `Lambda đang xử lý: ${opts} → ${state.outputFmt}...`);
  await sleep(400);
  setStep(3, 'done');

  // ── Step 4: Lưu Bucket B + DynamoDB ──
  setStep(4, 'active');
  await animateProgress(75, 90, 700, 'Lưu vào Bucket B + ghi metadata DynamoDB...');
  await sleep(300);
  setStep(4, 'done');
  state.stats.processed += count;
  state.stats.queue     -= count;
  animateStatTo('stat-processed', state.stats.processed);
  animateStatTo('stat-queue',     state.stats.queue);

  // ── Step 5: SNS Notification ──
  setStep(5, 'active');
  const notifyLabel = email ? `Gửi thông báo đến ${email}...` : 'Gửi thông báo SNS...';
  await animateProgress(90, 100, 400, notifyLabel);
  await sleep(200);
  setStep(5, 'done');

  // ── Done ──
  showToast(`✓ ${count} ảnh đã được xử lý thành công!`, 'success');
  submitBtn.disabled    = false;
  progLabel.textContent = 'Hoàn tất!';

  await sleep(2000);
  state.files           = [];
  renderPreviews();
  progSection.style.display = 'none';
  progFill.style.width      = '0%';
}
// ── Gallery ──
async function openGallery() {
  document.getElementById('gallerySection').style.display = 'block';
  document.getElementById('galleryGrid').innerHTML = '<p style="color:var(--muted); text-align:center; padding:20px;">Đang tải...</p>';

  try {
    const res = await fetch('https://aws-image-processor-1.onrender.com/api/images');
    const { images } = await res.json();

    if (!images.length) {
      document.getElementById('galleryGrid').innerHTML = '<p style="color:var(--muted); text-align:center; padding:20px;">Chưa có ảnh nào được xử lý</p>';
      return;
    }

    document.getElementById('galleryGrid').innerHTML = images.map(img => `
      <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden;">
        <img src="${img.processedUrl}" style="width:100%; aspect-ratio:1; object-fit:cover;"
            onerror="this.style.display='none'"/>
        <div style="padding:10px;">
          <div style="font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${img.originalName}</div>
          <div style="font-size:11px; color:var(--muted); margin-top:4px;">${(img.sizeBytes/1024).toFixed(1)} KB</div>
          <div style="font-size:11px; color:var(--muted);">${new Date(img.processedAt).toLocaleString('vi-VN')}</div>
          <a href="${img.processedUrl}" download style="display:block; margin-top:8px; text-align:center; padding:6px; background:rgba(124,107,255,.1); border:1px solid rgba(124,107,255,.3); border-radius:6px; color:var(--accent); font-size:11px; text-decoration:none;">⬇️ Tải về</a>
        </div>
      </div>
    `).join('');

  } catch (err) {
    document.getElementById('galleryGrid').innerHTML = `<p style="color:var(--danger); text-align:center; padding:20px;">Lỗi: ${err.message}</p>`;
  }
}

function closeGallery() {
  document.getElementById('gallerySection').style.display = 'none';
}