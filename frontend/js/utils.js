// ===================================
// utils.js — Helper functions
// ===================================

/**
 * Promise-based sleep
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Cubic ease-out easing
 * @param {number} t  — progress 0..1
 */
function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animate a numeric counter from its current value to `val`
 * @param {string} id  — element id
 * @param {number} val — target value
 */
function animateStatTo(id, val) {
  const el  = document.getElementById(id);
  const from = parseInt(el.textContent) || 0;
  const dur  = 600;
  const t0   = performance.now();

  const tick = (now) => {
    const p = Math.min((now - t0) / dur, 1);
    el.textContent = Math.round(from + (val - from) * easeOut(p));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * Animate the progress bar from `from`% to `to`% over `duration` ms
 * @param {number} from
 * @param {number} to
 * @param {number} duration  ms
 * @param {string} label     text shown next to bar
 */
function animateProgress(from, to, duration, label) {
  const progLabel = document.getElementById('progLabel');
  const progFill  = document.getElementById('progFill');
  const progPct   = document.getElementById('progPct');

  progLabel.textContent = label;
  const start = performance.now();

  return new Promise((resolve) => {
    function tick(now) {
      const t   = Math.min((now - start) / duration, 1);
      const val = Math.round(from + (to - from) * easeOut(t));
      progFill.style.width  = val + '%';
      progPct.textContent   = val + '%';
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

/**
 * Show a toast notification
 * @param {string} msg
 * @param {'info'|'success'|'error'} type
 */
let _toastTimer;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = `show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
