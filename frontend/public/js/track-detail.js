
let trackData = null;
let lyricCues = [];
let lyricRAF = null;
let waveformUpdater = null;
let playerUI = null;

window.setTrackData = function(data) {
  trackData = data;
  console.log('Track data received:', trackData);
};

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 14px;border-radius:10px;background:rgba(0,0,0,0.8);color:#fff;z-index:2000;font-size:14px;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

function formatTime(seconds) {
  if (isNaN(seconds) || !seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ========== LYRICS KARAOKE LOGIC ==========
function parseLRC(lrc) {
  if (!lrc || !lrc.trim()) return [];
  const out = [];
  lrc.split(/\r?\n/).forEach(line => {
    const m = line.match(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/);
    if (!m) return;
    const minutes = parseInt(m[1]);
    const seconds = parseInt(m[2]);
    const centiseconds = m[3] ? parseInt(m[3].padEnd(2, '0').substring(0, 2)) : 0;
    const t = minutes * 60 + seconds + (centiseconds / 100);
    out.push({ t, text: (m[4] || "").trim() || "[Instrumental]" });
  });
  return out.sort((a, b) => a.t - b.t);
}

function renderLyrics(lines) {
  const lyricsLinesEl = document.getElementById('lyricsLines');
  if (!lyricsLinesEl) return;
  
  if (!lines || lines.length === 0) {
    lyricsLinesEl.innerHTML = '<div class="lyrics-empty">Không có lyric</div>';
    return;
  }
  lyricsLinesEl.innerHTML = lines.map((line, i) => {
    const text = typeof line === 'string' ? line : (line.text || line);
    return `<div class="lyric-line" data-idx="${i}">${text || "&nbsp;"}</div>`;
  }).join("");
}

function startLyricSync() {
  cancelAnimationFrame(lyricRAF);
  const lyricsPanel = document.getElementById('lyricsPanel');
  const audio = window.player?.audio;
  
  if (!audio || !lyricCues || lyricCues.length === 0) return;

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
      
      const lyricsBody = document.querySelector('.lyrics-body');
      if (lyricsBody) {
        const bodyRect = lyricsBody.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        const relativeTop = activeRect.top - bodyRect.top + lyricsBody.scrollTop;
        const containerHeight = lyricsBody.clientHeight;
        const elementHeight = activeEl.offsetHeight;
        const targetScroll = relativeTop - (containerHeight / 2) + (elementHeight / 2);
        const currentScroll = lyricsBody.scrollTop;
        const diff = targetScroll - currentScroll;
        
        if (Math.abs(diff) > 1) {
          lyricsBody.scrollTop = currentScroll + (diff * 0.15);
        }
      }
    }
    lyricRAF = requestAnimationFrame(step);
  };
  lyricRAF = requestAnimationFrame(step);
}

async function loadLyrics() {
  console.log('Loading lyrics...', trackData.lyricsLRC ? 'LRC found' : 'No LRC');
  
  if (trackData.lyricsLRC && trackData.lyricsLRC.trim()) {
    lyricCues = parseLRC(trackData.lyricsLRC);
    console.log('Parsed LRC cues:', lyricCues.length);
    renderLyrics(lyricCues.map(c => c.text));
    startLyricSync();
    return;
  }
  
  if (trackData.lyricsText && trackData.lyricsText.trim()) {
    console.log('Using plain text lyrics');
    renderLyrics(trackData.lyricsText.split(/\r?\n/).filter(l => l.trim()));
    return;
  }
  
  console.log('No lyrics available');
  renderLyrics([]);
}

function openLyrics() {
  const lyricsPanel = document.getElementById('lyricsPanel');
  if (!lyricsPanel) return;
  
  lyricsPanel.removeAttribute('hidden');
  loadLyrics();
  startLyricSync();
}

function closeLyrics() {
  const lyricsPanel = document.getElementById('lyricsPanel');
  if (!lyricsPanel) return;
  
  lyricsPanel.setAttribute('hidden', '');
  cancelAnimationFrame(lyricRAF);
}

function initLyrics() {
  const toggleLyricsBtn = document.getElementById('toggleLyricsBtn');
  const closeLyricsBtn = document.getElementById('closeLyricsBtn');
  
  if (toggleLyricsBtn) {
    toggleLyricsBtn.addEventListener('click', () => {
      if (!window.player) {
        console.error('Player not ready');
        showToast('Player chưa sẵn sàng');
        return;
      }
      
      const isCurrentTrack = window.player.currentTrack && window.player.currentTrack.id === trackData.id;
      const lyricsPanel = document.getElementById('lyricsPanel');
      
      if (!isCurrentTrack) {
        console.log('Playing track first...');
        window.player.playTrack(trackData);
        setTimeout(openLyrics, 500);
      } else {
        lyricsPanel.hasAttribute('hidden') ? openLyrics() : closeLyrics();
      }
    });
  }

  if (closeLyricsBtn) {
    closeLyricsBtn.addEventListener('click', closeLyrics);
  }
}

function hookLyricEvents() {
  if (!window.player || !window.player.audio) {
    return setTimeout(hookLyricEvents, 100);
  }
  const audio = window.player.audio;
  const lyricsPanel = document.getElementById('lyricsPanel');
  
  ["play", "seeked", "timeupdate"].forEach(ev => 
    audio.addEventListener(ev, () => {
      if (lyricsPanel && !lyricsPanel.hasAttribute('hidden') && window.player?.currentTrack?.id === trackData.id) {
        startLyricSync();
      }
    })
  );
  console.log('Lyric events hooked');
}

// ========== COMMENT HANDLERS ==========
function initCommentHandlers() {
  document.addEventListener('click', async (e) => {
    // Like comment
    const likeBtn = e.target.closest('.comment-like');
    if (likeBtn) {
      const commentId = likeBtn.dataset.commentId;
      try {
        const res = await fetch(`/api/comments/${commentId}/like`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          likeBtn.dataset.liked = data.liked ? 'true' : 'false';
          const icon = likeBtn.querySelector('i');
          if (icon) icon.className = data.liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
          const count = likeBtn.querySelector('.comment-like-count');
          if (count) count.textContent = data.likes;
          showToast(data.liked ? 'Đã thả tim' : 'Đã bỏ tim');
        } else {
          showToast(data.message || 'Không thể thả tim bình luận');
        }
      } catch (err) {
        console.error('Comment like error:', err);
        showToast('Không thể thả tim bình luận');
      }
      return;
    }

    // Edit/Delete comment
    const editBtn = e.target.closest('.comment-edit');
    const deleteBtn = e.target.closest('.comment-delete');
    if (!editBtn && !deleteBtn) return;

    const commentId = (editBtn || deleteBtn).dataset.commentId;
    const commentEl = document.getElementById(`comment-${commentId}`);
    const canEdit = commentEl?.dataset?.canEdit === 'true';
    const textEl = commentEl?.querySelector('.comment-text');

    if (editBtn) {
      if (!canEdit) {
        showToast('Bạn không có quyền chỉnh sửa bình luận này');
        return;
      }
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
      if (!canEdit) {
        showToast('Bạn không có quyền xóa bình luận này');
        return;
      }
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
    if (!window.player || !window.player.audio) return;
    
    const isCurrentTrack = window.player.currentTrack && window.player.currentTrack.id === trackData.id;
    
    if (!isCurrentTrack) {
      window.player.playTrack(trackData);
      setTimeout(() => seekWaveform(e), 200);
    } else {
      seekWaveform(e);
    }
  });
  
  function seekWaveform(e) {
    const audio = window.player.audio;
    if (!audio || !audio.duration) return;
    
    const rect = waveformContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * audio.duration;
    
    audio.currentTime = newTime;
    updateWaveformProgress();
  }
  
  function updateWaveformProgress() {
    if (!window.player || !window.player.audio) return;
    
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
    console.log('Main play button clicked');
    
    if (!window.player || !window.player.audio) {
      console.error('Player not ready!');
      showToast('Player chưa sẵn sàng');
      return;
    }
    
    const isCurrentTrack = window.player.currentTrack && window.player.currentTrack.id === trackData.id;
    
    if (!isCurrentTrack) {
      console.log('Playing new track:', trackData.title);
      window.player.playTrack(trackData);
    } else {
      if (window.player.audio.paused) {
        console.log('Resuming playback');
        window.player.audio.play().catch(err => {
          console.error('Play error:', err);
          showToast('Không thể phát nhạc');
        });
      } else {
        console.log('Pausing playback');
        window.player.audio.pause();
      }
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
    if (icon) {
      if (isCurrentTrack && isPlaying) {
        icon.className = 'fa-solid fa-pause';
        mainPlayBtn.classList.add('playing');
      } else {
        icon.className = 'fa-solid fa-play';
        mainPlayBtn.classList.remove('playing');
      }
    }
    
    if (isCurrentTrack && currentTimeEl && durationEl) {
      currentTimeEl.textContent = formatTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        durationEl.textContent = formatTime(audio.duration);
      }
    }
    
    const bottomCur = document.getElementById('bottomCurrentTime');
    const bottomDur = document.getElementById('bottomDuration');
    if (isCurrentTrack) {
      if (bottomCur) bottomCur.textContent = formatTime(audio.currentTime);
      if (bottomDur && audio.duration && !isNaN(audio.duration)) {
        bottomDur.textContent = formatTime(audio.duration);
      }
    }
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

  function setLikeUI(liked, likes) {
    if (likeBtn) {
      likeBtn.dataset.liked = liked ? 'true' : 'false';
      likeBtn.classList.toggle('liked', liked);
      const icon = likeBtn.querySelector('i');
      if (icon) icon.className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      const countEl = document.getElementById('likeCount');
      if (countEl && typeof likes === 'number') countEl.textContent = likes;
    }
    
    const likeShortcutBtn = document.getElementById('playerLikeBtn');
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
      try {
        const trackId = this.dataset.trackId;
        if (!trackId) {
          console.error('Track ID not found');
          return;
        }
        const res = await fetch(`/api/tracks/${trackId}/like`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          setLikeUI(data.liked, data.likes);
          showToast(data.liked ? 'Đã thả tim' : 'Đã bỏ tim');
        } else {
          showToast(data.message || 'Không thể thả tim');
        }
      } catch (err) {
        console.error('Like error:', err);
        showToast('Không thể thả tim');
      }
    });
  }
  
  if (addToQueueBtn) {
    addToQueueBtn.addEventListener('click', () => {
      if (!window.player) {
        showToast('Player chưa sẵn sàng');
        return;
      }
      const ok = window.player.addToQueue(trackData);
      if (window.player.renderQueue) window.player.renderQueue();
      showToast(ok ? 'Đã thêm vào hàng đợi' : 'Bài hát đã có trong hàng đợi');
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const url = `${window.location.origin}/track/${trackData.id}`;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          showToast('Đã copy link bài hát');
        } else {
          prompt('Copy link:', url);
        }
      } catch (err) {
        prompt('Copy link:', url);
      }
    });
  }
  
  if (submitComment && commentInput) {
    submitComment.addEventListener('click', async function() {
      const text = commentInput.value.trim();
      if (!text) {
        showToast('Vui lòng nhập bình luận');
        return;
      }
      
      try {
        const res = await fetch(`/api/tracks/${trackData.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        
        const data = await res.json();
        if (data.success) {
          showToast('Đã thêm bình luận');
          setTimeout(() => location.reload(), 1000);
        } else {
          showToast(data.message || 'Không thể thêm bình luận');
        }
      } catch (err) {
        console.error(err);
        showToast('Không thể thêm bình luận');
      }
    });
    
    commentInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitComment.click();
      }
    });
  }

  initPlaylistModal();
  initReportModal();
}

function initPlaylistModal() {
  const addToPlaylistBtn = document.getElementById('addToPlaylistBtn');
  const playlistModal = document.getElementById('playlistModal');
  const playlistList = document.getElementById('playlistList');
  const playlistLoading = document.getElementById('playlistLoading');
  const playlistError = document.getElementById('playlistError');

  function closePlaylistModal() {
    playlistModal?.classList.remove('active');
  }

  async function loadPlaylists() {
    if (!playlistList) return;
    if (playlistLoading) playlistLoading.style.display = 'block';
    if (playlistError) playlistError.style.display = 'none';
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
      if (playlistError) {
        playlistError.style.display = 'block';
        playlistError.textContent = err.message || 'Không tải được playlist';
      }
    } finally {
      if (playlistLoading) playlistLoading.style.display = 'none';
    }
  }

  function openPlaylistModal() {
    if (!playlistModal) return;
    playlistModal.classList.add('active');
    loadPlaylists();
  }

  if (addToPlaylistBtn) {
    addToPlaylistBtn.addEventListener('click', openPlaylistModal);
  }
  
  window.closePlaylistModal = closePlaylistModal;
}

function initReportModal() {
  const reportBtn = document.getElementById('reportBtn');
  const submitReport = document.getElementById('submitReport');
  
  if (reportBtn) {
    reportBtn.addEventListener('click', () => {
      if (!reportBtn.dataset.trackId) {
        showToast('Không có track id');
        return;
      }
      if (typeof window.openReportModal === 'function') {
        window.openReportModal();
      }
    });
  }
  
  if (submitReport) {
    submitReport.addEventListener('click', async function() {
      const selectedReason = document.querySelector('input[name="reportReason"]:checked');
      if (!selectedReason) {
        showToast('Vui lòng chọn lý do báo cáo');
        return;
      }
      const reportBtn = document.getElementById('reportBtn');
      const trackId = reportBtn?.dataset.trackId;
      const reason = selectedReason.value;
      const description = (document.getElementById('reportDescription')?.value || '').trim();
      try {
        const res = await fetch(`/api/tracks/${trackId}/report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, description })
        });
        const data = await res.json();
        if (data.success) {
          if (typeof window.closeReportModal === 'function') {
            window.closeReportModal();
          }
          showToast(data.message || 'Đã gửi báo cáo');
        } else {
          showToast(data.message || 'Không thể gửi báo cáo');
        }
      } catch (err) {
        console.error('Report error:', err);
        showToast('Không thể gửi báo cáo');
      }
    });
  }
}

// ========== MV PLAYER ==========
function initMVPlayer() {
  const mvPlayer = document.getElementById('mvPlayer');
  const audioPlayer = window.player?.audio;
  
  if (!mvPlayer || !audioPlayer) return;
  
  audioPlayer.addEventListener('play', () => {
    if (window.player.currentTrack?.id === trackData.id) {
      mvPlayer.play().catch(err => console.log('MV autoplay blocked'));
    }
  });
  
  audioPlayer.addEventListener('pause', () => mvPlayer.pause());
  audioPlayer.addEventListener('ended', () => {
    mvPlayer.pause();
    mvPlayer.currentTime = 0;
  });
}

// ========== MAIN INIT ==========
function initDetailPage() {
  if (!window.player || !window.player.audio) {
    console.log('Waiting for player...');
    setTimeout(initDetailPage, 100);
    return;
  }
  
  console.log('🎵 Initializing track detail page...');
  
  waveformUpdater = initWaveform();
  if (waveformUpdater) {
    window.waveformUpdater = waveformUpdater;
  }
  
  playerUI = initPlayerUI();
  
  if (playerUI && waveformUpdater) {
    const audio = window.player.audio;
    
    ['play', 'pause', 'timeupdate', 'loadedmetadata', 'seeked'].forEach(event => {
      audio.addEventListener(event, () => {
        playerUI.updateUI();
        waveformUpdater.updateWaveformProgress();
      });
    });
    
    setInterval(() => {
      if (window.player.currentTrack?.id === trackData.id) {
        playerUI.updateUI();
        waveformUpdater.updateWaveformProgress();
         }
    }, 100);
    
    playerUI.updateUI();
    waveformUpdater.updateWaveformProgress();
  }
  
  initActions();
  initLyrics();
  initMVPlayer();
  initCommentHandlers();
  hookLyricEvents();

  console.log('✅ Track detail page initialized');
}

// ========== START ==========
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDetailPage);
} else {
  initDetailPage();
}