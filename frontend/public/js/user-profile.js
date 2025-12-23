// ===== USER PROFILE PAGE SCRIPT =====

document.addEventListener('DOMContentLoaded', () => {
  initFollowButton();
  initDeleteTrack();
  initTogglePrivacy();
});

/* ================= FOLLOW ================= */

function initFollowButton() {
  const followBtn = document.getElementById('followBtn');
  if (!followBtn) return;

  followBtn.addEventListener('click', async function (e) {
    e.stopPropagation();

    const username = this.dataset.username;
    const isFollowing = this.classList.contains('btn-secondary');
    const endpoint = isFollowing ? 'unfollow' : 'follow';

    try {
      const res = await fetch(`/users/${username}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();

      if (!data.success) return;

      if (isFollowing) {
        this.classList.remove('btn-secondary');
        this.classList.add('btn-primary');
        this.innerHTML = '<i class="fa-solid fa-user-plus"></i> Follow';
      } else {
        this.classList.remove('btn-primary');
        this.classList.add('btn-secondary');
        this.innerHTML = '<i class="fa-solid fa-user-check"></i> Following';
      }

      const followersStat = document.querySelector('.stat-value');
      if (followersStat) followersStat.textContent = data.followersCount;

      showNotification(data.message);
    } catch (err) {
      console.error('Follow error:', err);
      showNotification('Có lỗi xảy ra');
    }
  });
}

/* ================= DELETE TRACK ================= */

function initDeleteTrack() {
  document.querySelectorAll('.delete-track').forEach(btn => {
    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const trackId = this.dataset.id;
      if (!confirm('Bạn có chắc muốn xoá track này không?')) return;

      try {
        const res = await fetch(`/tracks/${trackId}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
          showNotification('Đã xoá track');
          this.closest('.track-item')?.remove();
        }
      } catch (err) {
        console.error('Delete track error:', err);
        showNotification('Có lỗi xảy ra');
      }
    });
  });
}

/* ================= TOGGLE PRIVACY ================= */

function initTogglePrivacy() {
  document.querySelectorAll('.toggle-privacy').forEach(btn => {
    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const trackId = this.dataset.id;
      const isPrivate = this.dataset.private === 'true';

      try {
        const res = await fetch(`/tracks/${trackId}/privacy`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPrivate: !isPrivate })
        });

        const data = await res.json();
        if (!data.success) {
          showNotification('Không thể cập nhật trạng thái track');
          return;
        }

        const newPrivate = !isPrivate;
        this.dataset.private = String(newPrivate);

        const icon = this.querySelector('i');
        if (newPrivate) {
          icon.className = 'fa-solid fa-lock';
          this.title = 'Private';
        } else {
          icon.className = 'fa-solid fa-globe';
          this.title = 'Public';
        }

        showNotification(
          newPrivate ? 'Track đã chuyển sang Private' : 'Track đã Public'
        );
      } catch (err) {
        console.error('Toggle privacy error:', err);
        showNotification('Có lỗi xảy ra');
      }
    });
  });
}

/* ================= NOTIFICATION ================= */

function showNotification(message) {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.textContent = message;
  document.body.appendChild(notif);

  setTimeout(() => {
    notif.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}
