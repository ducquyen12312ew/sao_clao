class MusicPlayer {
  constructor() {
    this.audio = document.getElementById('audioPlayer');
    this.currentTrack = null;
    this.queue = [];
    this.queueIndex = -1;
    this.isShuffled = false;
    this.repeatMode = 'off';
    this.originalQueue = [];
    if (!this.audio) return;
    this.initElements();
    this.initEventListeners();
    setTimeout(() => {
      this.restoreState();
    }, 100);
  }

  initEventListeners() {
    if (this.playPauseBtn) {
      this.playPauseBtn.addEventListener('click', () => this.togglePlay());
    }
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.playPrevious());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.playNext());
    }
    if (this.shuffleBtn) {
      this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
    }
    if (this.repeatBtn) {
      this.repeatBtn.addEventListener('click', () => this.cycleRepeat());
    }
    if (this.progressBar) {
      this.progressBar.addEventListener('click', (e) => this.seekTo(e));
    }
    if (this.volumeSlider) {
      this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
    }
    if (this.volumeIcon) {
      this.volumeIcon.addEventListener('click', () => this.toggleMute());
    }
    if (this.queueBtn) {
      this.queueBtn.addEventListener('click', () => this.toggleQueuePanel());
    }

    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
    this.audio.addEventListener('ended', () => this.handleTrackEnd());
    this.audio.addEventListener('play', () => this.updatePlayButton(true));
    this.audio.addEventListener('pause', () => this.updatePlayButton(false));
  }

  playTrack(track) {
    if (!track || !track.audioUrl) return;
    this.currentTrack = track;
    this.updateUI(track);
    this.audio.src = track.audioUrl;
    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        this.playerEl.classList.add('active');
        this.saveState();
      }).catch(() => {});
    }
  }

  togglePlay() {
    if (!this.audio.src) return;
    if (this.audio.paused) {
      this.audio.play().catch(() => {});
    } else {
      this.audio.pause();
    }
  }

  playNext() {
    if (this.queue.length === 0) return;
    if (this.repeatMode === 'one') {
      this.audio.currentTime = 0;
      this.audio.play();
      return;
    }
    let nextIndex = this.queueIndex + 1;
    if (nextIndex >= this.queue.length) {
      if (this.repeatMode === 'all') nextIndex = 0;
      else return;
    }
    this.queueIndex = nextIndex;
    this.playTrack(this.queue[nextIndex]);
  }

  playPrevious() {
    if (this.queue.length === 0) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    let prevIndex = this.queueIndex - 1;
    if (prevIndex < 0) {
      if (this.repeatMode === 'all') prevIndex = this.queue.length - 1;
      else return;
    }
    this.queueIndex = prevIndex;
    this.playTrack(this.queue[prevIndex]);
  }

  addToQueue(track) {
    const exists = this.queue.find(t => t.id === track.id);
    if (exists) return false;
    this.queue.push(track);
    this.originalQueue.push(track);
    if (this.queue.length === 1) {
      this.queueIndex = 0;
      this.playTrack(track);
    }
    this.renderQueue();
    this.saveState();
    return true;
  }

  toggleShuffle() {
    this.isShuffled = !this.isShuffled;
    this.shuffleBtn.classList.toggle('active', this.isShuffled);
    const current = this.queue[this.queueIndex];
    if (this.isShuffled) {
      this.queue = this.shuffleArray([...this.originalQueue]);
    } else {
      this.queue = [...this.originalQueue];
    }
    this.queueIndex = this.queue.findIndex(t => t.id === current?.id);
    this.renderQueue();
    this.saveState();
  }

  cycleRepeat() {
    const modes = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(this.repeatMode);
    this.repeatMode = modes[(currentIndex + 1) % modes.length];
    this.repeatBtn.classList.remove('active', 'repeat-one');
    if (this.repeatMode === 'all') {
      this.repeatBtn.classList.add('active');
    } else if (this.repeatMode === 'one') {
      this.repeatBtn.classList.add('active', 'repeat-one');
    }
    this.saveState();
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  handleTrackEnd() {
    if (this.repeatMode === 'one') {
      this.audio.currentTime = 0;
      this.audio.play();
    } else {
      this.playNext();
    }
  }

  seekTo(e) {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = bar.offsetWidth;
    const percent = clickX / width;
    this.audio.currentTime = percent * this.audio.duration;
  }

  setVolume(value) {
    this.audio.volume = value / 100;
    this.updateVolumeIcon(value);
    localStorage.setItem('volume', value);
  }

  toggleMute() {
    if (this.audio.volume > 0) {
      this.audio.dataset.prevVolume = this.audio.volume;
      this.audio.volume = 0;
      this.volumeSlider.value = 0;
    } else {
      const prevVolume = parseFloat(this.audio.dataset.prevVolume) || 0.5;
      this.audio.volume = prevVolume;
      this.volumeSlider.value = prevVolume * 100;
    }
    this.updateVolumeIcon(this.volumeSlider.value);
  }

  updateVolumeIcon(value) {
    let iconClass = 'fa-solid ';
    if (value == 0) {
      iconClass += 'fa-volume-xmark';
    } else if (value < 50) {
      iconClass += 'fa-volume-low';
    } else {
      iconClass += 'fa-volume-high';
    }
    if (this.volumeIcon) {
      this.volumeIcon.className = 'volume-icon ' + iconClass;
    }
  }

  updateProgress() {
    if (!this.audio.duration) return;
    const progress = (this.audio.currentTime / this.audio.duration) * 100;
    if (this.progressFill) {
      this.progressFill.style.width = progress + '%';
    }
    if (this.currentTimeEl) {
      this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
    }
  }

  updateDuration() {
    if (this.durationEl) {
      this.durationEl.textContent = this.formatTime(this.audio.duration);
    }
  }

  updatePlayButton(isPlaying) {
    const icon = this.playPauseBtn?.querySelector('i');
    if (icon) {
      icon.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }
    document.querySelectorAll('.play-btn').forEach(btn => {
      btn.classList.remove('playing');
      const btnIcon = btn.querySelector('i');
      if (btnIcon) {
        btnIcon.className = 'fa-solid fa-play';
      }
    });
    if (this.currentTrack && isPlaying) {
      const currentBtn = document.querySelector(`[data-track-id="${this.currentTrack.id}"] .play-btn`);
      if (currentBtn) {
        currentBtn.classList.add('playing');
        const btnIcon = currentBtn.querySelector('i');
        if (btnIcon) {
          btnIcon.className = 'fa-solid fa-pause';
        }
      }
    }
  }

  updateUI(track) {
    const playerTitle = document.getElementById('playerTitle');
    const playerArtist = document.getElementById('playerArtist');
    const playerThumb = document.getElementById('playerThumb');
    if (playerTitle) playerTitle.textContent = track.title;
    if (playerArtist) playerArtist.textContent = track.artist || 'Unknown Artist';
    const thumbHTML = track.cover ? `<img src="${track.cover}" alt="${track.title}">` : '';
    if (playerThumb) playerThumb.innerHTML = thumbHTML;
    const sidebarTitle = document.getElementById('sidebarTitle');
    const sidebarArtist = document.getElementById('sidebarArtist');
    const sidebarImage = document.getElementById('sidebarImage');
    if (sidebarTitle) sidebarTitle.textContent = track.title;
    if (sidebarArtist) sidebarArtist.textContent = track.artist || 'Unknown Artist';
    if (sidebarImage) sidebarImage.innerHTML = thumbHTML;
  }

  toggleQueuePanel() {
    if (this.queuePanel) {
      this.queuePanel.classList.toggle('active');
    }
  }

  renderQueue() {
    if (!this.queueList) return;
    this.queueList.innerHTML = this.queue.map((track, index) => `
      <div class="queue-item ${index === this.queueIndex ? 'current' : ''}" onclick="player.playQueueItem(${index})">
        <div class="queue-item-thumb">
          ${track.cover ? `<img src="${track.cover}" alt="${track.title}">` : ''}
        </div>
        <div class="queue-item-info">
          <div class="queue-item-title">${track.title}</div>
          <div class="queue-item-artist">${track.artist || 'Unknown'}</div>
        </div>
        <button class="queue-item-remove" onclick="event.stopPropagation(); player.removeFromQueue(${index})">✕</button>
      </div>
    `).join('');
    const queueCount = document.getElementById('queueCount');
    if (queueCount) queueCount.textContent = this.queue.length;
  }

  playQueueItem(index) {
    if (index < 0 || index >= this.queue.length) return;
    this.queueIndex = index;
    this.playTrack(this.queue[index]);
  }

  removeFromQueue(index) {
    const removedTrack = this.queue[index];
    this.queue.splice(index, 1);
    const origIndex = this.originalQueue.findIndex(t => t.id === removedTrack.id);
    if (origIndex !== -1) this.originalQueue.splice(origIndex, 1);
    if (index < this.queueIndex) {
      this.queueIndex--;
    } else if (index === this.queueIndex) {
      if (this.queue.length > 0) {
        this.queueIndex = Math.min(index, this.queue.length - 1);
        this.playTrack(this.queue[this.queueIndex]);
      } else {
        this.queueIndex = -1;
        this.audio.pause();
        if (this.playerEl) this.playerEl.classList.remove('active');
      }
    }
    this.renderQueue();
    this.saveState();
  }

  clearQueue() {
    this.queue = [];
    this.originalQueue = [];
    this.queueIndex = -1;
    this.audio.pause();
    this.audio.src = '';
    this.currentTrack = null;
    if (this.playerEl) this.playerEl.classList.remove('active');
    this.renderQueue();
    this.saveState();
  }

  handleKeyboard(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch(e.code) {
      case 'Space':
        e.preventDefault();
        this.togglePlay();
        break;
      case 'ArrowRight':
        if (e.shiftKey) this.playNext();
        else this.audio.currentTime = Math.min(this.audio.currentTime + 5, this.audio.duration);
        break;
      case 'ArrowLeft':
        if (e.shiftKey) this.playPrevious();
        else this.audio.currentTime = Math.max(this.audio.currentTime - 5, 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (this.volumeSlider) {
          this.volumeSlider.value = Math.min(100, parseInt(this.volumeSlider.value) + 5);
          this.setVolume(this.volumeSlider.value);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (this.volumeSlider) {
          this.volumeSlider.value = Math.max(0, parseInt(this.volumeSlider.value) - 5);
          this.setVolume(this.volumeSlider.value);
        }
        break;
    }
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async recordPlay(trackId) {
    try {
      await fetch(`/api/plays/${trackId}`, { method: 'POST' });
    } catch {}
  }

  saveState() {
    const state = {
      currentTrack: this.currentTrack,
      queue: this.queue,
      queueIndex: this.queueIndex,
      currentTime: this.audio.currentTime || 0,
      isShuffled: this.isShuffled,
      repeatMode: this.repeatMode,
      originalQueue: this.originalQueue
    };
    try {
      localStorage.setItem('playerState', JSON.stringify(state));
    } catch {}
  }

  restoreState() {
    try {
      const saved = localStorage.getItem('playerState');
      if (!saved) return;
      const state = JSON.parse(saved);
      if (!state.currentTrack || !state.currentTrack.audioUrl) return;
      this.currentTrack = state.currentTrack;
      this.queue = state.queue || [];
      this.originalQueue = state.originalQueue || [];
      this.queueIndex = state.queueIndex || 0;
      this.isShuffled = state.isShuffled || false;
      this.repeatMode = state.repeatMode || 'off';
      this.updateUI(state.currentTrack);
      this.audio.src = state.currentTrack.audioUrl;
      if (state.currentTime && state.currentTime > 0) {
        this.audio.currentTime = state.currentTime;
      }
      if (this.playerEl) this.playerEl.classList.add('active');
      if (this.shuffleBtn) this.shuffleBtn.classList.toggle('active', this.isShuffled);
      if (this.repeatBtn) {
        this.repeatBtn.classList.remove('active', 'repeat-one');
        if (this.repeatMode === 'all') this.repeatBtn.classList.add('active');
        else if (this.repeatMode === 'one') this.repeatBtn.classList.add('active', 'repeat-one');
      }
      this.renderQueue();
      const savedVolume = localStorage.getItem('volume');
      if (savedVolume) {
        if (this.volumeSlider) this.volumeSlider.value = savedVolume;
        this.audio.volume = savedVolume / 100;
        this.updateVolumeIcon(savedVolume);
      }
    } catch {
      localStorage.removeItem('playerState');
    }
  }
}

window.player = null;
window.addEventListener('DOMContentLoaded', () => {
  window.player = new MusicPlayer();
});

window.playTrack = function(id, title, artist, cover, audioUrl) {
  if (!window.player) {
    alert('Player chưa sẵn sàng. Vui lòng đợi vài giây và thử lại.');
    return;
  }
  const track = { id, title, artist, cover, audioUrl };
  window.player.playTrack(track);
};
