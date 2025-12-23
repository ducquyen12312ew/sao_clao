// Playlist Creation Modal JS
    function openModal() {
      document.getElementById('createModal').classList.add('active');
      document.getElementById('playlistName').focus();
    }
    
    function closeModal() {
      document.getElementById('createModal').classList.remove('active');
      document.getElementById('playlistName').value = '';
      document.getElementById('playlistDescription').value = '';
    }
    
    async function createPlaylist() {
      const name = document.getElementById('playlistName').value.trim();
      const description = document.getElementById('playlistDescription').value.trim();
      
      if (!name) {
        alert('Vui lòng nhập tên playlist');
        return;
      }
      
      try {
        const res = await fetch('/playlists/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, isPublic: document.getElementById('playlistIsPublic').checked })
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
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
    
    document.getElementById('playlistName')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') createPlaylist();
    });