// Playlist Detail Page JS
    // Đợi player khởi tạo xong
    window.addEventListener('DOMContentLoaded', () => {
      console.log('Playlist detail page loaded');
      
      // Load durations for all tracks
      loadTrackDurations();
      
      // Check player initialization
      const checkPlayer = setInterval(() => {
        if (window.player) {
          console.log('Player ready on playlist detail page');
          clearInterval(checkPlayer);
          
          // Update playing state after player is ready
          setTimeout(() => {
            updatePlayingState();
          }, 500);
        }
      }, 100);
      
      // Stop checking after 5 seconds
      setTimeout(() => clearInterval(checkPlayer), 5000);
    });
    
    // Load duration for all tracks (read audioUrl from DOM dataset)
    function loadTrackDurations() {
      const trackItems = document.querySelectorAll('.track-item');

      trackItems.forEach((item) => {
        const durationElement = item.querySelector('.track-duration');
        const audioUrl = item.dataset.trackAudio || item.getAttribute('data-track-audio');
        if (audioUrl) loadDuration(audioUrl, durationElement);
      });
    }
    
    // Load duration for a single track
    function loadDuration(audioUrl, element) {
      const audio = new Audio();
      
      audio.addEventListener('loadedmetadata', () => {
        const duration = audio.duration;
        if (duration && !isNaN(duration)) {
          element.textContent = formatTime(duration);
        }
      });
      
      audio.addEventListener('error', () => {
        element.textContent = '--:--';
      });
      
      audio.src = audioUrl;
    }
    
    // Format time helper
    function formatTime(seconds) {
      if (!seconds || isNaN(seconds)) return '--:--';
      
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Visualizer Animation
    function animateVisualizer() {
      const bars = document.querySelectorAll('.bar');
      const audio = document.getElementById('audioPlayer');
      
      function updateBars() {
        if (audio && !audio.paused) {
          bars.forEach((bar, i) => {
            const height = Math.random() * 80 + 20;
            bar.style.height = height + 'px';
          });
        } else {
          bars.forEach(bar => {
            bar.style.height = '20px';
          });
        }
        requestAnimationFrame(updateBars);
      }
      
      updateBars();
    }
    
    animateVisualizer();
    
    function getPlaylistTracks() {
      const trackEls = document.querySelectorAll('.track-item');
      return Array.from(trackEls).map(el => ({
        id: el.dataset.trackId,
        title: el.dataset.trackTitle || '',
        artist: el.dataset.trackArtist || '',
        cover: el.dataset.trackCover || '',
        audioUrl: el.dataset.trackAudio || '',
        duration: Number(el.dataset.trackDuration || 0),
        hidden: el.classList.contains('track-hidden')
      })).filter(t => t.id && t.audioUrl && !t.hidden);
    }

    // Play All Function
    function playAll() {
      if (!window.player) {
        alert('Player chưa sẵn sàng');
        return;
      }
      
      const tracks = getPlaylistTracks();
      
      if (tracks.length > 0) {
        window.player.queue = tracks;
        window.player.originalQueue = [...tracks];
        window.player.queueIndex = 0;
        window.player.isShuffled = false;
        window.player.playTrack(tracks[0]);
        window.player.renderQueue();
        window.player.saveState();
        
        setTimeout(updatePlayingState, 300);
      }
    }
    
    // Shuffle Play Function
    function shufflePlay() {
      if (!window.player) {
        alert('Player chưa sẵn sàng');
        return;
      }
      
      const tracks = getPlaylistTracks();
      
      if (tracks.length > 0) {
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        
        window.player.queue = shuffled;
        window.player.originalQueue = [...tracks];
        window.player.queueIndex = 0;
        window.player.isShuffled = true;
        window.player.playTrack(shuffled[0]);
        
        if (window.player.shuffleBtn) {
          window.player.shuffleBtn.classList.add('active');
        }
        
        window.player.renderQueue();
        window.player.saveState();
        
        setTimeout(updatePlayingState, 300);
      }
    }
    
    // Play Single Track
    window.playTrack = function(id, title, artist, cover, audioUrl) {
      if (!window.player) {
        alert('Player chưa sẵn sàng');
        return;
      }
      
      const track = { id, title, artist, cover, audioUrl };
      const tracks = getPlaylistTracks();
      const idx = tracks.findIndex(t => t.id === id);
      if (tracks.length > 0) {
        window.player.queue = tracks;
        window.player.originalQueue = [...tracks];
        window.player.queueIndex = idx >= 0 ? idx : 0;
      }
      window.player.playTrack(track);
      
      // Update UI
      setTimeout(updatePlayingState, 300);
    };

    // Helper to play using button data-attributes
    function playFromButton(btn) {
      const id = btn.getAttribute('data-track-id');
      const title = btn.getAttribute('data-track-title') || '';
      const artist = btn.getAttribute('data-track-artist') || '';
      const cover = btn.getAttribute('data-track-cover') || '';
      const audioUrl = btn.getAttribute('data-track-audio') || '';
      window.playTrack(id, title, artist, cover, audioUrl);
    }

    // Hide track handling (local per playlist)
    const hiddenKey = `playlist_hidden_<%= playlist._id %>`;
    function loadHiddenSet() {
      try {
        const raw = localStorage.getItem(hiddenKey);
        return new Set(raw ? JSON.parse(raw) : []);
      } catch {
        return new Set();
      }
    }
    function saveHiddenSet(set) {
      try {
        localStorage.setItem(hiddenKey, JSON.stringify(Array.from(set)));
      } catch (err) {
        console.error('Cannot save hidden list', err);
      }
    }
    const hiddenSet = loadHiddenSet();

    function applyHiddenState() {
      document.querySelectorAll('.track-item').forEach(item => {
        const id = item.dataset.trackId;
        const btn = item.querySelector('.btn-hide-track i');
        const isHidden = hiddenSet.has(id);
        item.classList.toggle('track-hidden', isHidden);
        if (btn) {
          btn.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-regular fa-eye';
        }
      });
    }

    function toggleHideTrack(btn) {
      const id = btn.closest('.track-item')?.dataset?.trackId;
      if (!id) return;
      if (hiddenSet.has(id)) {
        hiddenSet.delete(id);
      } else {
        hiddenSet.add(id);
      }
      saveHiddenSet(hiddenSet);
      applyHiddenState();
    }
    
    // Remove Track from Playlist
    async function removeTrack(trackId) {
      if (!confirm('Bạn có chắc muốn xóa bài hát này khỏi playlist?')) {
        return;
      }
      
      try {
        const res = await fetch('/playlists/<%= playlist._id %>/remove-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackId })
        });
        
        const data = await res.json();
        
        if (data.success) {
          location.reload();
        } else {
          alert(data.message || 'Xóa bài hát thất bại');
        }
      } catch (err) {
        console.error(err);
        alert('Có lỗi xảy ra');
      }
    }
    
    // Delete Playlist
    async function deletePlaylist() {
      if (!confirm('Bạn có chắc muốn xóa playlist này? Hành động này không thể hoàn tác.')) {
        return;
      }
      
      try {
        const res = await fetch('/playlists/<%= playlist._id %>/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await res.json();
        
        if (data.success) {
          window.location.href = '/playlists';
        } else {
          alert(data.message || 'Xóa playlist thất bại');
        }
      } catch (err) {
        console.error(err);
        alert('Có lỗi xảy ra');
      }
    }

    async function toggleVisibility(btn) {
      try {
  // Read current public state from DOM attribute and invert
  const isPublic = document.querySelector('.playlist-actions')?.dataset?.isPublic === 'true';
  const nextState = !isPublic;
        const res = await fetch('/playlists/<%= playlist._id %>/visibility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublic: nextState })
        });
        const data = await res.json();
        if (data.success) {
          alert(data.isPublic ? 'Đã bật chế độ công khai' : 'Đã chuyển về riêng tư');
          location.reload();
        } else {
          alert(data.message || 'Không thể cập nhật chế độ công khai');
        }
      } catch (err) {
        console.error(err);
        alert('Có lỗi xảy ra');
      }
    }

    function copyShareLink() {
      const link = window.location.origin + '/playlists/<%= playlist._id %>';
      navigator.clipboard.writeText(link).then(() => {
        alert('Đã sao chép link chia sẻ');
      }).catch(() => alert('Không thể sao chép link'));
    }
    
    // Update Playing State
    function updatePlayingState() {
      if (!window.player || !window.player.currentTrack) {
        return;
      }
      
      console.log('Updating playing state for:', window.player.currentTrack.id);
      
      // Remove all playing states
      document.querySelectorAll('.track-item').forEach(item => {
        item.classList.remove('playing');
      });
      
      // Add playing state to current track
      const currentTrackId = window.player.currentTrack.id;
      const currentItem = document.querySelector(`.track-item[data-track-id="${currentTrackId}"]`);
      if (currentItem) {
        currentItem.classList.add('playing');
        console.log('Track marked as playing:', currentTrackId);
      }
    }
    
    // Listen to player events
    const audio = document.getElementById('audioPlayer');
    if (audio) {
      audio.addEventListener('play', () => {
        console.log('Audio started playing');
        updatePlayingState();
      });
      
      audio.addEventListener('pause', () => {
        console.log('Audio paused');
        updatePlayingState();
      });
      
      audio.addEventListener('ended', updatePlayingState);
    }
    
    // Periodic update to sync state
    setInterval(() => {
      if (window.player && window.player.currentTrack) {
        updatePlayingState();
      }
    }, 2000);
    
    // Queue toggle
    document.getElementById('queueBtn')?.addEventListener('click', () => {
      document.getElementById('queuePanel').classList.toggle('active');
    });

    // Cập nhật thời lượng hiển thị từ dataset nếu cần
    document.addEventListener('DOMContentLoaded', () => {
      const items = document.querySelectorAll('.track-item');
      items.forEach(item => {
        const durationCell = item.querySelector('.track-duration');
        const dur = Number(item.dataset.trackDuration || 0);
        if (durationCell) durationCell.textContent = formatTime(dur);
      });
      applyHiddenState();
    });