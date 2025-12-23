// follow.js
    // follow/unfollow
    const followBtn = document.getElementById('followBtn');

    if (followBtn) {
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

          if (data.success) {
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
          }
        } catch (err) {
          console.error(err);
        }
      });
    }

    // toast
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