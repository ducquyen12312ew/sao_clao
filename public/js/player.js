// Advanced Music Player with Queue Management
class MusicPlayer {
  constructor() {
    this.audio = document.getElementById('audioPlayer');
    this.currentTrack = null;
    this.queue = [];
    this.queueIndex = -1;
    this.isShuffled = false;
    this.repeatMode = 'off'; // 'off', 'all', 'one'
    this.originalQueue = [];
    
    this.initElements();
    this.initEventListeners();
    this.restoreState();
  }

  initElements() {
    this.playerEl = document.getElementById('musicPlayer');
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.prevBtn = document.getElementById('prevBtn');
    this.nextBtn = document.getElementById('nextBtn');
    this.shuffleBtn = document.getElementById('shuffleBtn');
    this.repeatBtn = document.getElementById('repeatBtn');
    this.progressBar = document.getElementById('progressBar');
    this.progressFill = document.getElementById('progressFill');
    this.currentTimeEl = document.getElementById('currentTime');
    this.durationEl = document.getElementById('duration');
    this.volumeSlider = document.getElementById('volumeSlider');
    this.volumeIcon = document.getElementById('volumeIcon');
    this.queueBtn = document.getElementById('queueBtn');
    this.queuePanel = document.getElementById('queuePanel');
    this.queueList = document.getElementById('queueList');
  }

  initEventListeners() {
    // Playback controls
    this.playPauseBtn?.addEventListener('click', () => this.togglePlay());
    this.prevBtn?.addEventListener('click', () => this.playPrevious());
    this.nextBtn?.addEventListener('click', () => this.playNext());
    
    // Shuffle & Repeat
    this.shuffleBtn?.addEventListener('click', () => this.toggleShuffle());
    this.repeatBtn?.addEventListener('click', () => this.cycleRepeat());
    
    // Progress bar
    this.progressBar?.addEventListener('click', (e) => this.seekTo(e));
    
    // Volume
    this.volumeSlider?.addEventListener('input', (e) => this.setVolume(e.target.value));
    this.volumeIcon?.addEventListener('click', () => this.toggleMute());
    
    // Queue panel
    this.queueBtn?.addEventListener('click', () => this.toggleQueuePanel());
    
    // Audio events
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
    this.audio.addEventListener('ended', () => this.handleTrackEnd());
    this.audio.addEventListener('play', () => this.updatePlayButton(true));
    this.audio.addEventListener('pause', () => this.updatePlayButton(false));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  playTrack(track, autoAddToQueue = true) {
    this.currentTrack = track;
    
    // Tự động thêm vào queue khi play (trừ khi gọi từ queue)
    if (autoAddToQueue) {
      const existingIndex = this.queue.findIndex(t => t.id === track.id);
      
      if (existingIndex === -1) {
        // Bài hát chưa có trong queue - thêm mới
        this.queue.push(track);
        this.originalQueue.push(track);
        this.queueIndex = this.queue.length - 1;
      } else {
        // Bài hát đã có - chỉ cập nhật index
        this.queueIndex = existingIndex;
      }
    }
    
    this.updateUI(track);
    this.audio.src = track.audioUrl;
    this.audio.play();
    this.playerEl.classList.add('active');
    
    // Clear all playing states first
    document.querySelectorAll('.play-btn').forEach(btn => {
      btn.classList.remove('playing');
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = 'fa-solid fa-play';
      }
    });
    
    // Set current track as playing
    const currentBtn = document.querySelector(`[data-track-id="${track.id}"] .play-btn`);
    if (currentBtn) {
      currentBtn.classList.add('playing');
      const icon = currentBtn.querySelector('i');
      if (icon) {
        icon.className = 'fa-solid fa-pause';
      }
    }
    
    this.renderQueue();
    this.saveState();
    this.recordPlay(track.id);
  }

  togglePlay() {
    if (!this.audio.src) return;
    
    if (this.audio.paused) {
      this.audio.play();
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
      if (this.repeatMode === 'all') {
        nextIndex = 0;
      } else {
        return;
      }
    }
    
    this.queueIndex = nextIndex;
    this.playTrackFromQueue(nextIndex);
  }

  playPrevious() {
    if (this.queue.length === 0) return;
    
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    
    let prevIndex = this.queueIndex - 1;
    
    if (prevIndex < 0) {
      if (this.repeatMode === 'all') {
        prevIndex = this.queue.length - 1;
      } else {
        return;
      }
    }
    
    this.queueIndex = prevIndex;
    this.playTrackFromQueue(prevIndex);
  }

  playTrackFromQueue(index) {
    if (index < 0 || index >= this.queue.length) return;
    this.queueIndex = index;
    this.playTrack(this.queue[index], false);
  }

  toggleShuffle() {
    this.isShuffled = !this.isShuffled;
    this.shuffleBtn.classList.toggle('active', this.isShuffled);
    
    if (this.isShuffled) {
      const current = this.queue[this.queueIndex];
      this.queue = this.shuffleArray([...this.originalQueue]);
      this.queueIndex = this.queue.findIndex(t => t.id === current.id);
    } else {
      const current = this.queue[this.queueIndex];
      this.queue = [...this.originalQueue];
      this.queueIndex = this.queue.findIndex(t => t.id === current.id);
    }
    
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
    this.volumeIcon.className = 'volume-icon ' + iconClass;
  }

  updateProgress() {
    if (!this.audio.duration) return;
    
    const progress = (this.audio.currentTime / this.audio.duration) * 100;
    this.progressFill.style.width = progress + '%';
    this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
    
    if (this.currentTrack) {
      this.saveState();
    }
  }

  updateDuration() {
    this.durationEl.textContent = this.formatTime(this.audio.duration);
  }

  updatePlayButton(isPlaying) {
    const icon = this.playPauseBtn.querySelector('i');
    if (icon) {
      icon.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }
    
    // Update all cards - clear all first
    document.querySelectorAll('.play-btn').forEach(btn => {
      btn.classList.remove('playing');
      const btnIcon = btn.querySelector('i');
      if (btnIcon) {
        btnIcon.className = 'fa-solid fa-play';
      }
    });
    
    // Only update current track
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
    document.getElementById('playerTitle').textContent = track.title;
    document.getElementById('playerArtist').textContent = track.artist || 'Unknown Artist';
    document.getElementById('sidebarTitle').textContent = track.title;
    document.getElementById('sidebarArtist').textContent = track.artist || 'Unknown Artist';
    
    const thumbHTML = track.cover ? `<img src="${track.cover}" alt="${track.title}">` : '';
    document.getElementById('playerThumb').innerHTML = thumbHTML;
    document.getElementById('sidebarImage').innerHTML = thumbHTML;
    
    document.getElementById('rightSidebar')?.classList.add('active');
  }

  toggleQueuePanel() {
    this.queuePanel.classList.toggle('active');
  }

  renderQueue() {
    if (!this.queueList) return;
    
    this.queueList.innerHTML = this.queue.map((track, index) => `
      <div class="queue-item ${index === this.queueIndex ? 'current' : ''}" 
           onclick="player.playQueueItem(${index})">
        <div class="queue-item-thumb">
          ${track.cover ? `<img src="${track.cover}" alt="${track.title}">` : ''}
        </div>
        <div class="queue-item-info">
          <div class="queue-item-title">${track.title}</div>
          <div class="queue-item-artist">${track.artist || 'Unknown'}</div>
        </div>
        <button class="queue-item-remove" onclick="event.stopPropagation(); player.removeFromQueue(${index})">
          ✕
        </button>
      </div>
    `).join('');
    
    document.getElementById('queueCount').textContent = this.queue.length;
  }

  playQueueItem(index) {
    this.playTrackFromQueue(index);
  }

  removeFromQueue(index) {
    const removedTrack = this.queue[index];
    this.queue.splice(index, 1);
    
    // Remove from original queue too
    const origIndex = this.originalQueue.findIndex(t => t.id === removedTrack.id);
    if (origIndex !== -1) {
      this.originalQueue.splice(origIndex, 1);
    }
    
    if (index < this.queueIndex) {
      this.queueIndex--;
    } else if (index === this.queueIndex) {
      if (this.queue.length > 0) {
        this.playTrackFromQueue(Math.min(index, this.queue.length - 1));
      } else {
        this.audio.pause();
        this.playerEl.classList.remove('active');
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
    this.playerEl.classList.remove('active');
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
        if (e.shiftKey) {
          this.playNext();
        } else {
          this.audio.currentTime = Math.min(this.audio.currentTime + 5, this.audio.duration);
        }
        break;
      case 'ArrowLeft':
        if (e.shiftKey) {
          this.playPrevious();
        } else {
          this.audio.currentTime = Math.max(this.audio.currentTime - 5, 0);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.volumeSlider.value = Math.min(100, parseInt(this.volumeSlider.value) + 5);
        this.setVolume(this.volumeSlider.value);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.volumeSlider.value = Math.max(0, parseInt(this.volumeSlider.value) - 5);
        this.setVolume(this.volumeSlider.value);
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
    } catch (err) {
      console.error('Failed to record play:', err);
    }
  }

  saveState() {
    const state = {
      currentTrack: this.currentTrack,
      queue: this.queue,
      queueIndex: this.queueIndex,
      currentTime: this.audio.currentTime,
      isShuffled: this.isShuffled,
      repeatMode: this.repeatMode,
      originalQueue: this.originalQueue
    };
    localStorage.setItem('playerState', JSON.stringify(state));
  }

  restoreState() {
    try {
      const saved = localStorage.getItem('playerState');
      if (!saved) return;
      
      const state = JSON.parse(saved);
      
      if (state.currentTrack && state.queue) {
        this.queue = state.queue;
        this.originalQueue = state.originalQueue || state.queue;
        this.queueIndex = state.queueIndex || 0;
        this.isShuffled = state.isShuffled || false;
        this.repeatMode = state.repeatMode || 'off';
        
        this.updateUI(state.currentTrack);
        this.audio.src = state.currentTrack.audioUrl;
        this.audio.currentTime = state.currentTime || 0;
        this.playerEl.classList.add('active');
        document.getElementById('rightSidebar')?.classList.add('active');
        
        this.shuffleBtn.classList.toggle('active', this.isShuffled);
        this.repeatBtn.classList.remove('active', 'repeat-one');
        if (this.repeatMode === 'all') {
          this.repeatBtn.classList.add('active');
        } else if (this.repeatMode === 'one') {
          this.repeatBtn.classList.add('active', 'repeat-one');
        }
        
        this.renderQueue();
      }
      
      const savedVolume = localStorage.getItem('volume');
      if (savedVolume) {
        this.volumeSlider.value = savedVolume;
        this.audio.volume = savedVolume / 100;
        this.updateVolumeIcon(savedVolume);
      }
    } catch (err) {
      console.error('Failed to restore state:', err);
    }
  }
}

// Global function for onclick handlers
let player;

window.addEventListener('DOMContentLoaded', () => {
  player = new MusicPlayer();
});

function playTrack(id, title, artist, cover, audioUrl) {
  const track = { id, title, artist, cover, audioUrl };
  player.playTrack(track);
}