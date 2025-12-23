// ===== TOGGLE SIDEBAR =====
window.toggleSidebar = function () {
  const sidebar = document.getElementById('rightSidebar');
  const toggle = document.getElementById('sidebarToggle');
  const icon = toggle?.querySelector('i');
  if (!sidebar) return;

  sidebar.classList.toggle('active');
  if (icon) {
    icon.className = sidebar.classList.contains('active')
      ? 'fa-solid fa-chevron-right'
      : 'fa-solid fa-chevron-left';
  }
};

// ===== NOTIFICATION =====
function showNotification(message) {
  const existing = document.querySelector('.custom-notification');
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.className = 'custom-notification';
  notif.textContent = message;
  notif.style.cssText = `
    position: fixed;
    bottom: 120px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(40,40,40,.98);
    color: #fff;
    padding: 14px 24px;
    border-radius: 8px;
    font-weight: 600;
    z-index: 9999;
  `;
  document.body.appendChild(notif);

  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transform = 'translateX(-50%) translateY(8px)';
    notif.style.transition = '0.3s';
    setTimeout(() => notif.remove(), 300);
  }, 2000);
}

// ===== PLAY TRACK =====
function playTrackFromData(btn) {
  try {
    const data = JSON.parse(btn.dataset.track || '{}');
    if (window.playTrack && data.id) {
      window.playTrack(data.id, data.title, data.artist, data.cover, data.audioUrl);
    }
  } catch (err) {
    console.error('Cannot play track:', err);
  }
}

// ===== LIKE TRACK =====
async function toggleLike(trackId, btnEl) {
  try {
    const res = await fetch(`/api/tracks/${trackId}/like`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      showNotification(data.liked ? 'Đã thích' : 'Đã bỏ thích');
      if (!data.liked) {
        const card = btnEl.closest('.card');
        if (card) {
          card.style.opacity = '0';
          card.style.transform = 'translateY(6px)';
          setTimeout(() => card.remove(), 250);
        }
      }
    } else {
      showNotification('Không thể cập nhật yêu thích');
    }
  } catch (err) {
    console.error(err);
    showNotification('Lỗi khi cập nhật yêu thích');
  }
}
