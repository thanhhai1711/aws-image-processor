// ===================================
// dropzone.js — File drag-drop & preview
// ===================================

const dropzone    = document.getElementById('dropzone');
const fileInput   = document.getElementById('fileInput');
const previewGrid = document.getElementById('previewGrid');

// ── Click to open file picker ──
dropzone.addEventListener('click', () => fileInput.click());

// ── Drag over ──
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('drag-over');
});

// ── Drop files ──
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const images = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
  addFiles(images);
});

// ── File input change ──
fileInput.addEventListener('change', () => {
  addFiles([...fileInput.files]);
  fileInput.value = '';
});

// ── Add files to state + re-render ──
function addFiles(newFiles) {
  if (!newFiles.length) return;
  state.files.push(...newFiles);
  renderPreviews();
  showToast(`Đã thêm ${newFiles.length} ảnh`, 'info');
}

// ── Render thumbnail grid ──
function renderPreviews() {
  if (!state.files.length) {
    previewGrid.style.display = 'none';
    return;
  }

  previewGrid.style.display = 'grid';
  previewGrid.innerHTML     = '';

  state.files.forEach((file, i) => {
    const card = document.createElement('div');
    card.className           = 'preview-card';
    card.style.animationDelay = `${i * 60}ms`;

    // Thumbnail
    const img = document.createElement('img');
    img.src    = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);

    // Filename overlay
    const overlay = document.createElement('div');
    overlay.className = 'preview-overlay';
    overlay.innerHTML = `<div class="preview-name">${file.name}</div>`;

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'preview-remove';
    removeBtn.innerHTML = '×';
    removeBtn.onclick   = (e) => {
      e.stopPropagation();
      state.files.splice(i, 1);
      renderPreviews();
    };

    card.appendChild(img);
    card.appendChild(overlay);
    card.appendChild(removeBtn);
    previewGrid.appendChild(card);
  });
}
