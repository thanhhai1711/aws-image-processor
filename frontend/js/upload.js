// ===================================
// upload.js — Main upload handler & form controls
// ===================================

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

// ── Main upload & process flow ──
async function handleUpload() {
  if (!state.files.length) {
    showToast('Vui lòng chọn ít nhất 1 ảnh', 'error');
    return;
  }

  const email = document.getElementById('emailInput').value.trim();
  const count = state.files.length;

  submitBtn.disabled         = true;
  progSection.style.display  = 'flex';
  progFill.style.width       = '0%';
  resetSteps();

  // ── Step 1: Upload to Bucket A ──
  setStep(1, 'active');
  await animateProgress(0, 30, 800, `Đang upload ${count} ảnh lên Bucket A...`);

  /*
   * TODO (Thành viên A): Thay đoạn simulate bên dưới bằng API call thật:
   *
   * const formData = new FormData();
   * state.files.forEach(f => formData.append('images', f));
   * formData.append('options', JSON.stringify([...state.selectedOpts]));
   * formData.append('format', state.outputFmt);
   * formData.append('email', email);
   * const res = await fetch('http://localhost:3000/api/upload', { method: 'POST', body: formData });
   * const { uploadId } = await res.json();
   */

  await sleep(300);
  setStep(1, 'done');
  state.stats.uploaded += count;
  state.stats.queue    += count;
  animateStatTo('stat-uploaded', state.stats.uploaded);
  animateStatTo('stat-queue',    state.stats.queue);

  // ── Step 2: Lambda trigger ──
  setStep(2, 'active');
  await animateProgress(30, 50, 600, 'ObjectCreated event → kích hoạt Lambda...');
  await sleep(200);
  setStep(2, 'done');

  // ── Step 3: Image processing ──
  setStep(3, 'active');
  const opts = [...state.selectedOpts].join(', ');
  await animateProgress(50, 75, 1200, `Đang xử lý: ${opts} → ${state.outputFmt}...`);
  await sleep(400);
  setStep(3, 'done');

  // ── Step 4: Save to Bucket B + DynamoDB ──
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
  const notifyLabel = email
    ? `Gửi thông báo đến ${email}...`
    : 'Gửi thông báo SNS...';
  await animateProgress(90, 100, 400, notifyLabel);
  await sleep(200);
  setStep(5, 'done');

  // ── Done ──
  showToast(`✓ ${count} ảnh đã được xử lý thành công!`, 'success');
  submitBtn.disabled    = false;
  progLabel.textContent = 'Hoàn tất!';

  // Reset sau 2 giây
  await sleep(2000);
  state.files           = [];
  renderPreviews();
  progSection.style.display = 'none';
  progFill.style.width      = '0%';
}
