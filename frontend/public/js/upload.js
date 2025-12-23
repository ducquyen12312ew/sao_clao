
document.addEventListener('DOMContentLoaded', () => {
  const audioFile = document.getElementById('audioFile');
  const hiddenAudio = document.getElementById('hiddenAudio');
  const uploadBox = document.getElementById('uploadBox');
  const detailsForm = document.getElementById('detailsForm');
  const audioInfo = document.getElementById('audioInfo');
  const coverFile = document.getElementById('coverFile');
  const imagePreview = document.getElementById('imagePreview');

  if (!audioFile || !uploadBox) return;

  // ===== AUDIO INPUT =====
  audioFile.addEventListener('change', handleAudio);

  // ===== DRAG & DROP =====
  uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadBox.classList.add('dragover');
  });

  uploadBox.addEventListener('dragleave', () => {
    uploadBox.classList.remove('dragover');
  });

  uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('dragover');

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      audioFile.files = e.dataTransfer.files;
      handleAudio();
    }
  });

  // ===== COVER IMAGE PREVIEW =====
  coverFile?.addEventListener('change', () => {
    const file = coverFile.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.innerHTML = `<img src="${e.target.result}" alt="Cover">`;
      imagePreview.classList.remove('empty');
    };
    reader.readAsDataURL(file);
  });

  // ===== HANDLERS =====
  function handleAudio() {
    const file = audioFile.files[0];
    if (!file) return;

    const dt = new DataTransfer();
    dt.items.add(file);
    hiddenAudio.files = dt.files;

    uploadBox.style.display = 'none';
    detailsForm.classList.add('active');
    audioInfo.style.display = 'flex';

    document.getElementById('audioName').textContent = file.name;
    document.getElementById('audioSize').textContent =
      (file.size / 1024 / 1024).toFixed(1) + ' MB';
  }
});
