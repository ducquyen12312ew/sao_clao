// Read playlist metadata from the DOM
const playlistActionsEl = document.querySelector('.playlist-actions');
const PLAYLIST = {
  id: playlistActionsEl?.dataset?.playlistId || null,
  isPublic: playlistActionsEl?.dataset?.isPublic === 'true'
};
const hiddenKey = `playlist_hidden_${PLAYLIST.id}`;


document.addEventListener('DOMContentLoaded', () => {
  loadTrackDurations();
  applyHiddenState();
  initPlayerWatcher();
  initQueueToggle();
  animateVisualizer();
});


function loadTrackDurations() {
  document.querySelectorAll('.track-item').forEach(item => {
    const el = item.querySelector('.track-duration');
    const url = item.dataset.trackAudio;
    if (url) loadDuration(url, el);
  });
}

function loadDuration(url, el) {
  const audio = new Audio();
  audio.onloadedmetadata = () => {
    el.textContent = formatTime(audio.duration);
  };
  audio.onerror = () => el.textContent = '--:--';
  audio.src = url;
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '--:--';
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}


function animateVisualizer() {
  const bars = document.querySelectorAll('.bar');
  const audio = document.getElementById('audioPlayer');

  function tick() {
    bars.forEach(bar => {
      bar.style.height = audio && !audio.paused
        ? `${Math.random() * 80 + 20}px`
        : '20px';
    });
    requestAnimationFrame(tick);
  }
  tick();
}


function getPlaylistTracks() {
  return [...document.querySelectorAll('.track-item')]
    .map(el => ({
      id: el.dataset.trackId,
      title: el.dataset.trackTitle,
      artist: el.dataset.trackArtist,
      cover: el.dataset.trackCover,
      audioUrl: el.dataset.trackAudio,
      hidden: el.classList.contains('track-hidden')
    }))
    .filter(t => t.id && t.audioUrl && !t.hidden);
}


window.playTrack = function (id, title, artist, cover, audioUrl) {
  if (!window.player) return alert('Player chưa sẵn sàng');

  const tracks = getPlaylistTracks();
  const idx = tracks.findIndex(t => t.id === id);

  window.player.queue = tracks;
  window.player.originalQueue = [...tracks];
  window.player.queueIndex = idx >= 0 ? idx : 0;

  window.player.playTrack({ id, title, artist, cover, audioUrl });
  setTimeout(updatePlayingState, 300);
};

window.playAll = function () {
  const tracks = getPlaylistTracks();
  if (!tracks.length || !window.player) return;

  Object.assign(window.player, {
    queue: tracks,
    originalQueue: [...tracks],
    queueIndex: 0,
    isShuffled: false
  });

  window.player.playTrack(tracks[0]);
  window.player.renderQueue();
  window.player.saveState();
  // update shuffle button UI
  const sb = document.getElementById('shuffleBtn');
  if (sb) sb.classList.remove('active');
};

window.shufflePlay = function () {
  const tracks = getPlaylistTracks();
  if (!tracks.length || !window.player) return;

  const shuffled = [...tracks].sort(() => Math.random() - 0.5);

  Object.assign(window.player, {
    queue: shuffled,
    originalQueue: [...tracks],
    queueIndex: 0,
    isShuffled: true
  });

  window.player.playTrack(shuffled[0]);
  const sb = document.getElementById('shuffleBtn');
  if (sb) sb.classList.add('active');
  window.player.renderQueue();
  window.player.saveState();
};

// Play from an inline button element (used by each track's play button)
window.playFromButton = function (btn) {
  if (!btn) return;
  const id = btn.dataset.trackId;
  const title = btn.dataset.trackTitle;
  const artist = btn.dataset.trackArtist;
  const cover = btn.dataset.trackCover;
  const audio = btn.dataset.trackAudio;
  if (!audio || !id) return alert('Không tìm thấy audio để phát');
  // Use the same behavior as window.playTrack to set the queue
  window.playTrack(id, title, artist, cover, audio);
};


function updatePlayingState() {
  document.querySelectorAll('.track-item').forEach(i => i.classList.remove('playing'));
  const id = window.player?.currentTrack?.id;
  if (!id) return;
  document.querySelector(`.track-item[data-track-id="${id}"]`)?.classList.add('playing');
}

function initPlayerWatcher() {
  const audio = document.getElementById('audioPlayer');
  ['play', 'pause', 'ended'].forEach(ev =>
    audio?.addEventListener(ev, updatePlayingState)
  );

  setInterval(() => {
    if (window.player?.currentTrack) updatePlayingState();
  }, 2000);
}


function loadHiddenSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(hiddenKey) || '[]'));
  } catch {
    return new Set();
  }
}

const hiddenSet = loadHiddenSet();

function saveHiddenSet() {
  localStorage.setItem(hiddenKey, JSON.stringify([...hiddenSet]));
}

function applyHiddenState() {
  document.querySelectorAll('.track-item').forEach(item => {
    const id = item.dataset.trackId;
    const icon = item.querySelector('.btn-hide-track i');
    const hidden = hiddenSet.has(id);
    item.classList.toggle('track-hidden', hidden);
    if (icon) icon.className = hidden ? 'fa-solid fa-eye-slash' : 'fa-regular fa-eye';
  });
}

window.toggleHideTrack = function (btn) {
  const id = btn.closest('.track-item')?.dataset.trackId;
  if (!id) return;
  hiddenSet.has(id) ? hiddenSet.delete(id) : hiddenSet.add(id);
  saveHiddenSet();
  applyHiddenState();
};

/* ================= PLAYLIST ACTIONS ================= */

window.removeTrack = async function (trackId) {
  if (!confirm('Xóa bài hát khỏi playlist?')) return;
  const res = await fetch(`/playlists/${PLAYLIST.id}/remove-track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackId })
  });
  const data = await res.json();
  if (data.success) location.reload();
};

window.deletePlaylist = async function () {
  if (!confirm('Xóa playlist? Không thể hoàn tác')) return;
  const res = await fetch(`/playlists/${PLAYLIST.id}/delete`, { method: 'POST' });
  const data = await res.json();
  if (data.success) location.href = '/playlists';
};

window.toggleVisibility = async function () {
  const next = !PLAYLIST.isPublic;
  if (!PLAYLIST.id) return alert('Playlist ID missing');
  const res = await fetch(`/playlists/${PLAYLIST.id}/visibility`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPublic: next })
  });
  const data = await res.json();
  if (data.success) location.reload();
};

window.copyShareLink = function () {
  if (!PLAYLIST.id) return alert('Playlist ID missing');
  navigator.clipboard
    .writeText(`${location.origin}/playlists/${PLAYLIST.id}`)
    .then(() => alert('Đã sao chép link'));
};

/* ================= QUEUE ================= */

function initQueueToggle() {
  document.getElementById('queueBtn')?.addEventListener('click', () => {
    document.getElementById('queuePanel')?.classList.toggle('active');
  });
}

// expose for debugging
window.__PLAYLIST_DETAIL__ = PLAYLIST;