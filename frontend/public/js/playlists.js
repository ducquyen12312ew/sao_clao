// ===== PLAYLISTS PAGE SCRIPT =====

// Open create playlist modal
function openModal() {
  const modal = document.getElementById('createModal');
  const nameInput = document.getElementById('playlistName');

  if (modal) modal.classList.add('active');
  if (nameInput) nameInput.focus();
}

// Close modal
function closeModal() {
  const modal = document.getElementById('createModal');
  const nameInput = document.getElementById('playlistName');
  const descInput = document.getElementById('playlistDescription');
  const publicCheckbox = document.getElementById('playlistIsPublic');

  if (modal) modal.classList.remove('active');
  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
  if (publicCheckbox) publicCheckbox.checked = false;
}

// Create playlist
async function createPlaylist() {
  const nameInput = document.getElementById('playlistName');
  const descInput = document.getElementById('playlistDescription');
  const publicCheckbox = document.getElementById('playlistIsPublic');

  const name = nameInput?.value.trim();
  const description = descInput?.value.trim();
  const isPublic = !!publicCheckbox?.checked;

  if (!name) {
    alert('Vui lòng nhập tên playlist');
    return;
  }

  try {
    const res = await fetch('/playlists/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, isPublic })
    });

    const data = await res.json();

    if (data.success) {
      location.reload();
    } else {
      alert(data.message || 'Tạo playlist thất bại');
    }
  } catch (err) {
    console.error(err);
    alert('Có lỗi xảy ra');
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('playlistName')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createPlaylist();
  });
});

// Expose to global scope (HTML onclick cần)
window.openModal = openModal;
window.closeModal = closeModal;
window.createPlaylist = createPlaylist;
