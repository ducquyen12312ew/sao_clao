const trackData = JSON.parse('<%- JSON.stringify({ id: track._id || "", title: track.title || "", artist: track.artist || "", cover: track.coverUrl || "", audioUrl: track.audioUrl || "", lyricsLRC: track.lyricsLRC || "", lyricsText: track.lyricsText || "", liked: !!liked }) %>');

// ========== LYRICS KARAOKE LOGIC ==========
let lyricCues = [];
let lyricRAF = null;

const lyricsPanel = document.getElementById('lyricsPanel');
const lyricsLinesEl = document.getElementById('lyricsLines');
const toggleLyricsBtn = document.getElementById('toggleLyricsBtn');
const closeLyricsBtn = document.getElementById('closeLyricsBtn');

function parseLRC(lrc) {
  if (!lrc) return [];
  const out = [];
  lrc.split(/\r?\n/).forEach(line => {
    const m = line.match(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\](.*)/);
    if (!m) return;
    const t = (+m[1]) * 60 + (+m[2]) + ((+m[3] || 0) / 100);
    out.push({ t, text: (m[4] || "").trim() });
  });
  return out.sort((a, b) => a.t - b.t);
}

function renderLyrics(lines) {
  if (!lines.length) {
    lyricsLinesEl.innerHTML = '<div class="lyrics-empty">Không có lyric</div>';
    return;
  }
  lyricsLinesEl.innerHTML = lines.map((t, i) => 
    `<div class="lyric-line" data-idx="${i}">${t || "&nbsp;"}</div>`
  ).join("");
}

function startLyricSync() {
  cancelAnimationFrame(lyricRAF);
  const audio = window.player?.audio;
  if (!audio || !lyricCues.length) return;

  const step = () => {
    if (lyricsPanel.hasAttribute('hidden')) return;
    if (window.player?.currentTrack?.id !== trackData.id) {
      lyricRAF = requestAnimationFrame(step);
      return;
    }

    const t = audio.currentTime;
    let i = 0;
    while (i + 1 < lyricCues.length && lyricCues[i + 1].t <= t) i++;

    document.querySelectorAll('.lyric-line.active').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.lyric-line.passed').forEach(el => el.classList.remove('passed'));

    const activeEl = document.querySelector(`.lyric-line[data-idx="${i}"]`);
    if (activeEl) {
      for (let k = 0; k < i; k++) {
        const p = document.querySelector(`.lyric-line[data-idx="${k}"]`);
        if (p) p.classList.add('passed');
      }
      activeEl.classList.add('active');
      activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    lyricRAF = requestAnimationFrame(step);
  };
  lyricRAF = requestAnimationFrame(step);
}

async function loadLyrics() {
  if (trackData.lyricsLRC) {
    lyricCues = parseLRC(trackData.lyricsLRC);
    renderLyrics(lyricCues.map(c => c.text));
    startLyricSync();
    return;
  }
  if (trackData.lyricsText) {
    renderLyrics(trackData.lyricsText.split(/\r?\n/));
    return;
  }
  renderLyrics([]);
}

function openLyrics() {
  lyricsPanel.removeAttribute('hidden');
  loadLyrics();
  startLyricSync();
}

function closeLyrics() {
  lyricsPanel.setAttribute('hidden', '');
  cancelAnimationFrame(lyricRAF);
}

if (toggleLyricsBtn) {
  toggleLyricsBtn.addEventListener('click', () => {
    lyricsPanel.hasAttribute('hidden') ? openLyrics() : closeLyrics();
  });
}

if (closeLyricsBtn) {
  closeLyricsBtn.addEventListener('click', closeLyrics);
}

(function autoOpenLyricsIfAvailable() {
  const hasLyrics = (trackData.lyricsLRC && trackData.lyricsLRC.trim().length > 0) ||
                    (trackData.lyricsText && trackData.lyricsText.trim().length > 0);
  if (hasLyrics) {
    openLyrics();
  }
})();

(function hookLyricEvents() {
  const audio = window.player?.audio;
  if (!audio) return setTimeout(hookLyricEvents, 100);
  ["play", "seeked"].forEach(ev => 
    audio.addEventListener(ev, () => 
      !lyricsPanel.hasAttribute('hidden') && startLyricSync()
    )
  );
})();

// ========== REPORT MODAL ==========
function openReportModal() {
  const modal = document.getElementById('reportModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeReportModal() {
  const modal = document.getElementById('reportModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    const radios = document.querySelectorAll('input[name="reportReason"]');
    radios.forEach(r => r.checked = false);
    document.getElementById('reportDescription').value = '';
  }
}

const reportBtn = document.getElementById('reportBtn');
if (reportBtn) {
  reportBtn.addEventListener('click', openReportModal);
}

const submitReport = document.getElementById('submitReport');
if (submitReport) {
  submitReport.addEventListener('click', async function() {
    const selectedReason = document.querySelector('input[name="reportReason"]:checked');
    
    if (!selectedReason) {
      alert('Vui lòng chọn lý do báo cáo');
      return;
    }
    
    const trackId = reportBtn.dataset.trackId;
    const reason = selectedReason.value;
    const description = document.getElementById('reportDescription').value.trim();
    
    try {
      const res = await fetch(`/api/tracks/${trackId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, description })
      });
      
      const data = await res.json();
      
      if (data.success) {
        closeReportModal();
        alert(data.message);
      } else {
        alert(data.message || 'Có lỗi xảy ra');
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi gửi báo cáo');
    }
  });
}

// ========== ADMIN ACTIONS ==========
const adminApproveBtn = document.getElementById('adminApproveBtn');
const adminRejectBtn = document.getElementById('adminRejectBtn');
const adminDeleteBtn = document.getElementById('adminDeleteBtn');

if (adminApproveBtn) {
  adminApproveBtn.addEventListener('click', async function() {
    if (!confirm('Phê duyệt bài hát này?')) return;
    
    const trackId = this.dataset.trackId;
    
    try {
      const res = await fetch(`/admin/tracks/${trackId}/approve`, {
        method: 'POST'
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert('Đã phê duyệt bài hát');
        location.reload();
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra');
    }
  });
}

if (adminRejectBtn) {
  adminRejectBtn.addEventListener('click', async function() {
    if (!confirm('Từ chối bài hát này?')) return;
    
    const trackId = this.dataset.trackId;
    
    try {
      const res = await fetch(`/admin/tracks/${trackId}/reject`, {
        method: 'POST'
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert('Đã từ chối bài hát');
        location.reload();
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra');
    }
  });
}

if (adminDeleteBtn) {
  adminDeleteBtn.addEventListener('click', async function() {
    if (!confirm('XÓA bài hát này? Hành động này có thể khôi phục được.')) return;
    
    const trackId = this.dataset.trackId;
    
    try {
      const res = await fetch(`/admin/tracks/${trackId}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert('Đã xóa bài hát');
        window.location.href = '/admin/dashboard';
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra');
    }
  });
}

// ========== DELETE COMMENT (ADMIN) ==========
document.addEventListener('click', async function(e) {
  const deleteBtn = e.target.closest('.admin-delete-comment');
  if (!deleteBtn) return;
  
  const commentId = deleteBtn.getAttribute('data-comment-id');
  
  if (!confirm('Xóa comment này?')) return;
  
  try {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (data.success) {
      const commentEl = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
      if (commentEl) {
        commentEl.style.opacity = '0';
        commentEl.style.transition = 'all 0.3s';
        commentEl.style.transform = 'translateX(-20px)';
        setTimeout(() => commentEl.remove(), 300);
      }
      
      const countEl = document.querySelector('.comments-title');
      if (countEl) {
        const match = countEl.textContent.match(/\d+/);
        if (match) {
          const currentCount = parseInt(match[0]);
          countEl.textContent = `Comments (${currentCount - 1})`;
        }
      }
    } else {
      alert(data.message || 'Không thể xóa comment');
    }
  } catch (err) {
    console.error(err);
    alert('Có lỗi xảy ra khi xóa comment');
  }
});

// ========== SEARCH FUNCTIONALITY ==========
function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const searchDropdown = document.getElementById('searchDropdown');
  
  if (!searchInput || !searchClear || !searchDropdown) return;
  
  let searchTimeout;
  
  searchInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    
    searchClear.classList.toggle('active', query.length > 0);
    clearTimeout(searchTimeout);
    
    if (query.length < 2) {
      searchDropdown.classList.remove('active');
      return;
    }
    
    searchDropdown.innerHTML = '<div class="search-dropdown-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tìm kiếm...</div>';
    searchDropdown.classList.add('active');
    
    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data.success) {
          displaySearchResults(data.users || [], data.tracks || [], query);
        } else {
          searchDropdown.innerHTML = '<div class="search-dropdown-empty">Không tìm thấy kết quả</div>';
        }
      } catch (err) {
        console.error('Search error:', err);
        searchDropdown.innerHTML = '<div class="search-dropdown-empty">Lỗi khi tìm kiếm</div>';
      }
    }, 300);
  });
  
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.remove('active');
    searchDropdown.classList.remove('active');
    searchInput.focus();
  });
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      searchDropdown.classList.remove('active');
    }
  });
}

function displaySearchResults(users, tracks, query) {
  const searchDropdown = document.getElementById('searchDropdown');
  
  if (!searchDropdown) return;
  
  if (users.length === 0 && tracks.length === 0) {
    searchDropdown.innerHTML = '<div class="search-dropdown-empty">Không tìm thấy kết quả</div>';
    return;
  }
  
  let html = '';
  
  if (users.length > 0) {
    html += '<div class="search-section-title">Nghệ sĩ</div>';
    
    users.slice(0, 5).forEach(user => {
      const avatarHtml = user.avatarUrl 
        ? `<img src="${user.avatarUrl}" alt="${user.username}">`
        : `<div class="avatar-placeholder">${user.username.charAt(0).toUpperCase()}</div>`;
      
      html += `
        <a href="/users/${user.username}" class="search-dropdown-item search-artist-item">
          <div class="search-dropdown-cover artist-avatar">
            ${avatarHtml}
          </div>
          <div class="search-dropdown-info">
            <div class="search-dropdown-title">${user.name || user.username}</div>
            <div class="search-dropdown-artist">@${user.username} • ${user.trackCount || 0} bài hát</div>
          </div>
          <div class="search-dropdown-badge">
            <i class="fa-solid fa-user"></i>
          </div>
        </a>
      `;
    });
  }
  
  if (tracks.length > 0) {
    html += '<div class="search-section-title">Bài hát</div>';
    
    tracks.slice(0, 8).forEach(track => {
      const trackTitle = track.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const trackArtist = (track.artist || 'Unknown Artist').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const trackCover = track.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100';
      
      html += `
        <a href="/track/${track._id}" class="search-dropdown-item">
          <div class="search-dropdown-cover">
            <img src="${trackCover}" alt="${track.title}">
          </div>
          <div class="search-dropdown-info">
            <div class="search-dropdown-title">${track.title}</div>
            <div class="search-dropdown-artist">${track.artist || 'Unknown Artist'}</div>
          </div>
          <div class="search-dropdown-play" onclick="event.preventDefault(); event.stopPropagation(); playTrackFromSearch('${track._id}', '${trackTitle}', '${trackArtist}', '${trackCover}', '${track.audioUrl}')">
            <i class="fa-solid fa-play"></i>
          </div>
        </a>
      `;
    });
  }
  
  searchDropdown.innerHTML = html;
}

window.playTrackFromSearch = function(id, title, artist, cover, audioUrl) {
  if (window.player) {
    window.player.playTrack({ id, title, artist, cover, audioUrl });
  }
};

// ========== WAVEFORM ==========
function initWaveform() {
  const waveform = document.getElementById('waveform');
  const waveformContainer = document.querySelector('.waveform-container');
  
  if (!waveform || !waveformContainer) return null;
  
  const totalBars = 150;
  const bars = [];
  
  for (let i = 0; i < totalBars; i++) {
    const bar = document.createElement('div');
    bar.className = 'waveform-bar';
    
    const baseHeight = 30 + Math.random() * 40;
    const variation = Math.sin(i / 10) * 20;
    const randomness = Math.random() * 15;
    const height = Math.max(15, Math.min(90, baseHeight + variation + randomness));
    
    bar.style.height = height + '%';
    bars.push(bar);
    waveform.appendChild(bar);
  }
  
  const progressOverlay = document.createElement('div');
  progressOverlay.className = 'waveform-progress';
  progressOverlay.style.width = '0%';
  waveformContainer.appendChild(progressOverlay);
  
  waveformContainer.addEventListener('click', (e) => {
    if (!window.player.currentTrack || window.player.currentTrack.id !== trackData.id) {
      window.player.playTrack(trackData);
      setTimeout(() => seekWaveform(e), 200);
    } else {
      seekWaveform(e);
    }
  });
  
  function seekWaveform(e) {
    const audio = window.player.audio;
    if (!audio.duration) return;
    
    const rect = waveformContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * audio.duration;
    
    audio.currentTime = newTime;
    updateWaveformProgress();
  }
  
  function updateWaveformProgress() {
    const isCurrentTrack = window.player?.currentTrack?.id === trackData.id;
    
    if (isCurrentTrack && window.player.audio.duration) {
      const percentage = (window.player.audio.currentTime / window.player.audio.duration) * 100;
      progressOverlay.style.width = percentage + '%';
      
      bars.forEach((bar, index) => {
        const barPercentage = (index / totalBars) * 100;
        if (barPercentage <= percentage) {
          bar.classList.add('played');
        } else {
          bar.classList.remove('played');
        }
      });
    }
  }
  
  return { updateWaveformProgress };
}

// ========== PLAYER UI ==========
function initPlayerUI() {
  const mainPlayBtn = document.getElementById('mainPlayBtn');
  const currentTimeEl = document.getElementById('currentTime');
  const durationEl = document.getElementById('duration');
  
  if (!mainPlayBtn) return null;
  
  // Load duration immediately
  loadTrackDuration();
  
  function loadTrackDuration() {
    const tempAudio = new Audio();
    
    tempAudio.addEventListener('loadedmetadata', () => {
      if (durationEl && tempAudio.duration && !isNaN(tempAudio.duration)) {
        durationEl.textContent = formatTime(tempAudio.duration);
      }
    });
    
    tempAudio.addEventListener('error', () => {
      if (durationEl) {
        durationEl.textContent = '--:--';
      }
    });
    
    tempAudio.src = trackData.audioUrl;
  }
  
  mainPlayBtn.addEventListener('click', () => {
    if (window.player.currentTrack?.id === trackData.id) {
      window.player.togglePlay();
    } else {
      window.player.playTrack(trackData);
    }
    setTimeout(() => {
      updateUI();
      if (window.waveformUpdater) window.waveformUpdater.updateWaveformProgress();
    }, 50);
  });
  
  function updateUI() {
    if (!window.player || !window.player.audio) return;
    
    const audio = window.player.audio;
    const isCurrentTrack = window.player.currentTrack?.id === trackData.id;
    const isPlaying = !audio.paused;
    
    const icon = mainPlayBtn.querySelector('i');
    if (isCurrentTrack && isPlaying) {
      icon.className = 'fa-solid fa-pause';
      mainPlayBtn.classList.add('playing');
      const bottomCur = document.getElementById('bottomCurrentTime');
      const bottomDur = document.getElementById('bottomDuration');
      if (bottomCur) bottomCur.textContent = formatTime(audio.currentTime);
      if (bottomDur && audio.duration && !isNaN(audio.duration)) {
        bottomDur.textContent = formatTime(audio.duration);
      }
    } else {
      icon.className = 'fa-solid fa-play';
      mainPlayBtn.classList.remove('playing');
    }
    
    if (isCurrentTrack && currentTimeEl && durationEl) {
      currentTimeEl.textContent = formatTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        durationEl.textContent = formatTime(audio.duration);
      }
    }
  }
  
  function formatTime(seconds) {
    if (isNaN(seconds) || !seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  return { updateUI };
}

// ========== ACTIONS ==========
function initActions() {
  const likeBtn = document.getElementById('likeBtn');
  const addToQueueBtn = document.getElementById('addToQueueBtn');
  const shareBtn = document.getElementById('shareBtn');
  const submitComment = document.getElementById('submitComment');
  const commentInput = document.getElementById('commentInput');
  const likeShortcutBtn = document.getElementById('playerLikeBtn');

  function setLikeUI(liked, likes) {
    if (likeBtn) {
      likeBtn.dataset.liked = liked ? 'true' : 'false';
      likeBtn.classList.toggle('liked', liked);
      const icon = likeBtn.querySelector('i');
      if (icon) icon.className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      const countEl = document.getElementById('likeCount');
      if (countEl && typeof likes === 'number') countEl.textContent = likes;
    }
    if (likeShortcutBtn) {
      likeShortcutBtn.dataset.liked = liked ? 'true' : 'false';
      const icon = document.getElementById('playerLikeIcon') || likeShortcutBtn.querySelector('i');
      if (icon) icon.className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      likeShortcutBtn.style.color = liked ? '#ff4d4f' : 'var(--text-secondary)';
    }
    if (window.player && typeof window.player.updateLikeUI === 'function') {
      window.player.updateLikeUI(!!liked);
    }
  }
  
  if (likeBtn) {
    likeBtn.addEventListener('click', async function() {
      const trackId = this.dataset.trackId;
      try {
        const res = await fetch(`/api/tracks/${trackId}/like`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          setLikeUI(data.liked, data.likes);
        }
      } catch (err) {
        console.error(err);
      }
    });
  }
  if (likeShortcutBtn) {
    setLikeUI(likeShortcutBtn.dataset.liked === 'true');
  }
  
  if (addToQueueBtn) {
    addToQueueBtn.addEventListener('click', () => {
      if (!window.player) {
        alert('Player chưa sẵn sàng. Vui lòng thử lại sau.');
        return;
      }
      const ok = window.player.addToQueue(trackData);
      window.player.renderQueue();
      const toast = document.createElement('div');
      toast.textContent = ok ? 'Đã thêm vào hàng đợi' : 'Bài hát đã có trong hàng đợi';
      toast.style.position = 'fixed';
      toast.style.bottom = '20px';
      toast.style.right = '20px';
      toast.style.padding = '12px 14px';
      toast.style.borderRadius = '10px';
      toast.style.background = 'rgba(0,0,0,0.8)';
      toast.style.color = '#fff';
      toast.style.zIndex = '2000';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    });
  }

  // ========== ADD TO PLAYLIST ==========
  const addToPlaylistBtn = document.getElementById('addToPlaylistBtn');
  const playlistModal = document.getElementById('playlistModal');
  const playlistList = document.getElementById('playlistList');
  const playlistLoading = document.getElementById('playlistLoading');
  const playlistError = document.getElementById('playlistError');

  function closePlaylistModal() {
    if (playlistModal) playlistModal.classList.remove('active');
  }

  async function loadPlaylists() {
    if (!playlistList) return;
    playlistLoading.style.display = 'block';
    playlistError.style.display = 'none';
    playlistList.innerHTML = '';
    try {
      const res = await fetch(`/playlists/api/mine?trackId=${trackData.id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Không tải được playlist');
      const lists = data.playlists || [];
      if (lists.length === 0) {
        playlistList.innerHTML = '<div style="color: var(--text-secondary);">Bạn chưa có playlist nào.</div>';
      } else {
        lists.forEach(pl => {
          const item = document.createElement('div');
          item.className = 'playlist-item';
          const left = document.createElement('div');
          left.innerHTML = `<div class="playlist-name">${pl.name}</div><div class="playlist-meta">${pl.isPublic ? 'Công khai' : 'Riêng tư'}</div>`;
          const btn = document.createElement('button');
          btn.className = 'playlist-add-btn';
          btn.textContent = pl.hasTrack ? 'Đã có' : 'Thêm';
          if (pl.hasTrack) btn.disabled = true;
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Đang thêm...';
            try {
              const resAdd = await fetch(`/playlists/${pl._id}/add-track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackId: trackData.id })
              });
              const dataAdd = await resAdd.json();
              if (dataAdd.success) {
                btn.textContent = 'Đã thêm';
                showToast('Đã thêm vào playlist');
              } else {
                btn.disabled = false;
                btn.textContent = 'Thêm';
                showToast(dataAdd.message || 'Không thể thêm vào playlist');
              }
            } catch (err) {
              console.error('Add to playlist error:', err);
              btn.disabled = false;
              btn.textContent = 'Thêm';
              showToast('Không thể thêm vào playlist');
            }
          });
          item.appendChild(left);
          item.appendChild(btn);
          playlistList.appendChild(item);
        });
      }
    } catch (err) {
      console.error('Load playlists error:', err);
      playlistError.style.display = 'block';
      playlistError.textContent = err.message || 'Không tải được playlist';
    } finally {
      playlistLoading.style.display = 'none';
    }
  }

  function openPlaylistModal() {
    if (!playlistModal) return;
    playlistModal.classList.add('active');
    loadPlaylists();
  }

  // expose for inline onclick
  window.closePlaylistModal = closePlaylistModal;
  window.openPlaylistModal = openPlaylistModal;

  if (addToPlaylistBtn) {
    addToPlaylistBtn.addEventListener('click', openPlaylistModal);
  }

  
  // Like shortcut to /likes
  
  function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 14px';
    toast.style.borderRadius = '10px';
    toast.style.background = 'rgba(0,0,0,0.8)';
    toast.style.color = '#fff';
    toast.style.zIndex = '2000';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const url = `${window.location.origin}/track/${trackData.id}`;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          showToast('Đã copy link bài hát vào clipboard');
        } else {
          prompt('Sao chép link bài hát:', url);
        }
      } catch (err) {
        console.error('Copy failed:', err);
        prompt('Sao chép link bài hát:', url);
      }
    });
  }
  
  if (submitComment && commentInput) {
    submitComment.addEventListener('click', async function() {
      const text = commentInput.value.trim();
      if (!text) return;
      
      try {
        const res = await fetch(`/api/tracks/${trackData.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        
        const data = await res.json();
        if (data.success) {
          location.reload();
        }
      } catch (err) {
        console.error(err);
      }
    });
    
    commentInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitComment.click();
      }
    });
  }
  
  document.querySelectorAll('.comment-like').forEach(btn => {
    btn.addEventListener('click', async () => {
      const commentId = btn.dataset.commentId;
      try {
        const res = await fetch(`/api/comments/${commentId}/like`, { method: 'POST' });
        let data = {};
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Request failed');
        } else {
          data = await res.json();
        }
        if (data.success) {
          btn.dataset.liked = data.liked ? 'true' : 'false';
          const icon = btn.querySelector('i');
          if (icon) icon.className = data.liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
          const count = btn.querySelector('.comment-like-count');
          if (count) count.textContent = data.likes;
          showToast(data.liked ? 'Đã thả tim' : 'Đã bỏ tim');
        } else {
          showToast(data.message || 'Không thể thả tim bình luận');
        }
      } catch (err) {
        console.error('Comment like error:', err);
        const msg = err.message && err.message.includes('<!DOCTYPE') ? 'Không thể thả tim bình luận' : err.message;
        showToast(msg || 'Không thể thả tim bình luận');
      }
    });
  });

  // Edit / Delete own comment
  document.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.comment-edit');
    const deleteBtn = e.target.closest('.comment-delete');
    if (!editBtn && !deleteBtn) return;

    const commentId = (editBtn || deleteBtn).dataset.commentId;
    const commentEl = document.getElementById(`comment-${commentId}`);
    const textEl = commentEl?.querySelector('.comment-text');

    if (editBtn) {
      const currentText = textEl ? textEl.textContent.trim() : '';
      const newText = prompt('Chỉnh sửa bình luận', currentText);
      if (newText === null) return;
      if (!newText.trim()) {
        showToast('Nội dung không được trống');
        return;
      }
      try {
        const res = await fetch(`/api/comments/${commentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: newText })
        });
        const data = await res.json();
        if (data.success) {
          if (textEl) textEl.textContent = newText;
          showToast('Đã cập nhật bình luận');
        } else {
          showToast(data.message || 'Không thể cập nhật bình luận');
        }
      } catch (err) {
        console.error('Edit comment error:', err);
        showToast('Không thể cập nhật bình luận');
      }
      return;
    }

    if (deleteBtn) {
      if (!confirm('Xóa bình luận này?')) return;
      try {
        const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          commentEl?.remove();
          showToast('Đã xóa bình luận');
        } else {
          showToast(data.message || 'Không thể xóa bình luận');
        }
      } catch (err) {
        console.error('Delete comment error:', err);
        showToast('Không thể xóa bình luận');
      }
    }
  });
}

// ========== MV PLAYER ==========
function initMVPlayer() {
  const mvPlayer = document.getElementById('mvPlayer');
  const audioPlayer = window.player?.audio;
  
  if (!mvPlayer || !audioPlayer) return;
  
  audioPlayer.addEventListener('play', () => {
    const isCurrentTrack = window.player.currentTrack?.id === trackData.id;
    if (isCurrentTrack) {
      mvPlayer.play().catch(err => console.log('MV autoplay blocked:', err));
    }
  });
  
  audioPlayer.addEventListener('pause', () => {
    mvPlayer.pause();
  });
  
  audioPlayer.addEventListener('ended', () => {
    mvPlayer.pause();
    mvPlayer.currentTime = 0;
  });
  
  if (!audioPlayer.paused && window.player.currentTrack?.id === trackData.id) {
    mvPlayer.play().catch(err => console.log('MV autoplay blocked:', err));
  }
}

// ========== INIT PAGE ==========
function initDetailPage() {
  if (!window.player) {
    setTimeout(initDetailPage, 100);
    return;
  }
  
  console.log('🎵 Initializing track detail page...');
  
  initSearch();
  
  const waveformUpdater = initWaveform();
  if (waveformUpdater) {
    window.waveformUpdater = waveformUpdater;
  }
  
  const playerUI = initPlayerUI();
  
  if (playerUI && waveformUpdater) {
    const audio = window.player.audio;
    
    audio.addEventListener('play', () => {
      playerUI.updateUI();
    });
    
    audio.addEventListener('pause', () => {
      playerUI.updateUI();
    });
    
    audio.addEventListener('timeupdate', () => {
      playerUI.updateUI();
      waveformUpdater.updateWaveformProgress();
    });
    
    audio.addEventListener('loadedmetadata', () => {
      playerUI.updateUI();
      waveformUpdater.updateWaveformProgress();
    });
    
    audio.addEventListener('seeked', () => {
      waveformUpdater.updateWaveformProgress();
    });
    
    // Sync UI periodically
    setInterval(() => {
      const isCurrentTrack = window.player.currentTrack?.id === trackData.id;
      if (isCurrentTrack) {
        playerUI.updateUI();
        waveformUpdater.updateWaveformProgress();
      }
    }, 100);
    
    // Initial update
    playerUI.updateUI();
    waveformUpdater.updateWaveformProgress();
  }
  
  initActions();
  initMVPlayer();

  console.log('✅ Track detail page initialized');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDetailPage);
} else {
  initDetailPage();
}