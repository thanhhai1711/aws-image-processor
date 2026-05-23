// ===================================
// pipeline.js — Pipeline step UI
// ===================================

/**
 * Set the visual state of a pipeline step
 * @param {number} n           — step number 1-5
 * @param {'active'|'done'|'idle'} status
 */
function setStep(n, status) {
  const step = document.getElementById(`step-${n}`);
  if (!step) return;

  step.classList.remove('active', 'done');
  const statusEl = step.querySelector('.step-status');

  if (status === 'active') {
    step.classList.add('active');
    statusEl.textContent = 'Đang chạy';
  } else if (status === 'done') {
    step.classList.add('done');
    statusEl.textContent = 'Xong ✓';
  } else {
    statusEl.textContent = 'Chờ';
  }
}

/** Reset all 5 steps to idle */
function resetSteps() {
  for (let i = 1; i <= 5; i++) setStep(i, 'idle');
}
