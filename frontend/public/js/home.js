let userPlaylists = window.__HOME_DATA__?.playlists || [];
console.log('Initial playlists from server:', userPlaylists.length);

/**
 * toggleSidebar()
 * - Mục đích: Mở/đóng sidebar bên phải và đổi icon nút toggle.
 * - Side-effects: thay đổi class 'active' trên #rightSidebar và cập nhật icon trong #sidebarToggle.
 */
window.toggleSidebar = function() {
  const sidebar = document.getElementById('rightSidebar');
  const toggle = document.getElementById('sidebarToggle');
  const icon = toggle?.querySelector('i');
  
  if (!sidebar) return;
  
  sidebar.classList.toggle('active');
  
  if (icon) {
    if (sidebar.classList.contains('active')) {
      icon.className = 'fa-solid fa-chevron-right';
    } else {
      icon.className = 'fa-solid fa-chevron-left';
    }
  }
};

/**
 * playTrack(id, title, artist, cover, audioUrl)
 * - Mục đích: Proxy gọi player.playTrack nếu player đã khởi tạo.
 * - Params: id, title, artist, cover, audioUrl
 */
window.playTrack = function(id, title, artist, cover, audioUrl) {
  if (window.player) {
    window.player.playTrack({ id, title, artist, cover, audioUrl });
  }
};

/**
 * playFromButton(btn)
 * - Mục đích: Xử lý sự kiện khi người dùng nhấn nút play trên card.
 * - Params: btn (element nút chứa data-* attributes của track)
 * - Behavior: nếu player chưa sẵn sàng -> cảnh báo; nếu track đang phát thì toggle play; ngược lại play track và thêm vào hàng đợi.
 */
function playFromButton(btn) {
  const track = {
    id: btn.dataset.trackId,
    title: btn.dataset.trackTitle,
    artist: btn.dataset.trackArtist,
    cover: btn.dataset.trackCover,
    audioUrl: btn.dataset.trackAudio
  };
  if (!window.player) {
    alert('Player chưa sẵn sàng. Vui lòng thử lại.');
    return;
  }
  if (window.player.currentTrack?.id === track.id) {
    window.player.togglePlay();
  } else {
    window.player.playTrack(track);
    window.player.addToQueue(track);
  }
}

/**
 * playTrackFromSearch(id, title, artist, cover, audioUrl)
 * - Mục đích: Phát track khi người dùng nhấn play từ danh sách kết quả tìm kiếm.
 */
window.playTrackFromSearch = function(id, title, artist, cover, audioUrl) {
  if (window.player) {
    window.player.playTrack({ id, title, artist, cover, audioUrl });
  }
};

/**
 * addToQueue(track)
 * - Mục đích: Thêm track vào hàng đợi player.
 * - Params: track object { id, title, artist, cover, audioUrl }
 * - Side-effects: showNotification tùy kết quả, đóng context menu.
 */
window.addToQueue = function(track) {
  if (!track) {
    showNotification('Lỗi: Không có bài hát');
    return;
  }
  
  if (!window.player) {
    showNotification('Lỗi: Player chưa sẵn sàng');
    return;
  }
  
  const success = window.player.addToQueue(track);
  
  if (success) {
    showNotification('Đã thêm vào hàng đợi');
  } else {
    showNotification('Bài hát đã có trong hàng đợi');
  }
  
  closeContextMenu();
};

/**
 * openCreatePlaylistModal()
 * - Mục đích: Mở modal tạo playlist mới và focus vào input tên.
 * - Side-effects: đóng context menu hiện tại.
 */
window.openCreatePlaylistModal = function() {
  closeContextMenu();
  const modal = document.getElementById('createPlaylistModal');
  const input = document.getElementById('playlistName');
  
  if (modal) modal.classList.add('active');
  if (input) {
    input.focus();
    input.value = '';
  }
  
  const descInput = document.getElementById('playlistDescription');
  if (descInput) descInput.value = '';
};

/**
 * closeCreatePlaylistModal()
 * - Mục đích: Đóng modal tạo playlist và reset các input liên quan.
 */
window.closeCreatePlaylistModal = function() {
  const modal = document.getElementById('createPlaylistModal');
  const nameInput = document.getElementById('playlistName');
  const descInput = document.getElementById('playlistDescription');
  
  if (modal) modal.classList.remove('active');
  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
};

/**
 * createPlaylist()
 * - Mục đích: Gửi request tạo playlist mới tới server.
 * - Flow:
 *   1. Lấy tên và mô tả từ form, validate tên.
 *   2. POST /playlists/create JSON { name, description }.
 *   3. Nếu thành công: load lại playlists, nếu có contextTrack thì tự động add vào playlist mới, reload page.
 * - Side-effects: showNotification, đóng modal, reload.
 */
window.createPlaylist = async function() {
  const nameInput = document.getElementById('playlistName');
  const descInput = document.getElementById('playlistDescription');
  
  const name = nameInput?.value.trim();
  const description = descInput?.value.trim();
  
  if (!name) {
    showNotification('Vui lòng nhập tên playlist');
    return;
  }
  
  try {
    const res = await fetch('/playlists/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: description || '' })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showNotification('Tạo playlist thành công');
      closeCreatePlaylistModal();
      
      await loadPlaylists();
      
      if (window.contextTrack) {
        await addToPlaylist(data.playlist._id);
      }
      
      setTimeout(() => location.reload(), 1000);
    } else {
      showNotification(data.message || 'Tạo playlist thất bại');
    }
  } catch (err) {
    showNotification('Có lỗi xảy ra');
  }
};

/**
 * initResizeSidebar()
 * - Mục đích: Thiết lập sự kiện kéo để thay đổi kích thước sidebar phải.
 * - Behavior: bắt mousedown trên handle, theo dõi mousemove và mouseup trên document.
 */
function initResizeSidebar() {
  const resizeHandle = document.getElementById('resizeHandle');
  const rightSidebar = document.getElementById('rightSidebar');
  
  if (!resizeHandle || !rightSidebar) return;
  
  let isResizing = false;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    rightSidebar.style.transition = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 320), 600);
    rightSidebar.style.width = newWidth + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      rightSidebar.style.transition = '';
    }
  });
}

/**
 * initSearch()
 * - Mục đích: Khởi tạo chức năng tìm kiếm (debounce, fetch API, hiển thị dropdown kết quả).
 * - Side-effects: thêm element #searchDropdown nếu chưa có, xử lý sự kiện input/focus/clear.
 */
function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  let searchDropdown = document.getElementById('searchDropdown');
  
  if (!searchInput || !searchClear) return;
  
  if (!searchDropdown) {
    searchDropdown = document.createElement('div');
    searchDropdown.id = 'searchDropdown';
    searchDropdown.className = 'search-dropdown';
    
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer) {
      searchContainer.appendChild(searchDropdown);
    } else {
      return;
    }
  }
  
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
        const url = `/api/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.success) {
          displaySearchResults(data.users || [], data.tracks || [], query);
        } else {
          searchDropdown.innerHTML = '<div class="search-dropdown-empty">Không tìm thấy kết quả</div>';
        }
      } catch (err) {
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
  
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2 && searchDropdown.children.length > 0) {
      searchDropdown.classList.add('active');
    }
  });
  
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchClear.classList.remove('active');
      searchDropdown.classList.remove('active');
      searchInput.blur();
    }
  });
}

/**
 * displaySearchResults(users, tracks, query)
 * - Mục đích: Hiển thị kết quả tìm kiếm trong dropdown.
 * - Params: users array, tracks array, query string (chưa sử dụng trong hàm nhưng có thể dùng để highlight)
 * - Side-effects: cập nhật innerHTML của #searchDropdown.
 */
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

/**
 * loadPlaylists()
 * - Mục đích: Tải danh sách playlist của user từ API /api/playlists.
 * - Behavior: nếu API trả lỗi hoặc không có, sử dụng dữ liệu server-side đã embed (window.__HOME_DATA__).
 * - Side-effects: cập nhật `userPlaylists` và gọi updatePlaylistSubmenu().
 */
async function loadPlaylists() {
  try {
    console.log('Loading playlists from API...');
    const res = await fetch('/api/playlists');
    
    if (!res.ok) {
      console.log('API not found, using server-side data');
      updatePlaylistSubmenu();
      return;
    }
    
    const data = await res.json();
    console.log('Playlists API response:', data);
    
    if (data.success && data.playlists) {
      userPlaylists = data.playlists;
      console.log('User playlists loaded:', userPlaylists.length, 'playlists');
    }
    
    updatePlaylistSubmenu();
  } catch (err) {
    console.error('Load playlists error:', err);
    console.log('Using existing playlists data:', userPlaylists.length);
    updatePlaylistSubmenu();
  }
}

/**
 * updatePlaylistSubmenu()
 * - Mục đích: Cập nhật DOM submenu chứa danh sách playlist (ở context menu).
 * - Side-effects: tạo các .submenu-item và attach onclick để addToPlaylist.
 */
function updatePlaylistSubmenu() {
  const submenu = document.getElementById('playlistSubmenu');
  if (!submenu) {
    console.log('Submenu not found!');
    return;
  }
  
  console.log('Updating playlist submenu with', userPlaylists.length, 'playlists');
  
  submenu.innerHTML = `
    <div class="submenu-item create-new" onclick="openCreatePlaylistModal()">
      <i class="fa-solid fa-plus"></i> Tạo playlist mới
    </div>
  `;
  
  userPlaylists.forEach(playlist => {
    console.log('Adding playlist:', playlist.name);
    const item = document.createElement('div');
    item.className = 'submenu-item';
    item.textContent = playlist.name;
    item.onclick = (e) => {
      e.stopPropagation();
      addToPlaylist(playlist._id);
    };
    submenu.appendChild(item);
  });
  
  console.log('Submenu updated. Total items:', submenu.children.length);
}

/**
 * showContextMenu(e, id, title, artist, cover, audioUrl)
 * - Mục đích: Hiển thị context menu khi người dùng click chuột phải trên track card.
 * - Params: MouseEvent e, track metadata
 * - Side-effects: set window.contextTrack, position và show #contextMenu, attach close listener.
 */
function showContextMenu(e, id, title, artist, cover, audioUrl) {
  e.preventDefault();
  e.stopPropagation();
  
  const menu = document.getElementById('contextMenu');
  if (!menu) return;
  
  window.contextTrack = { 
    id: id, 
    title: title, 
    artist: artist, 
    cover: cover, 
    audioUrl: audioUrl 
  };
  
  menu.style.left = e.pageX + 'px';
  menu.style.top = e.pageY + 'px';
  menu.classList.add('active');
  
  updatePlaylistSubmenu();
  
  setTimeout(() => {
    document.addEventListener('click', closeContextMenu);
  }, 10);
}

/**
 * closeContextMenu()
 * - Mục đích: Đóng context menu nếu đang mở và remove listener đóng.
 */
function closeContextMenu() {
  const menu = document.getElementById('contextMenu');
  if (!menu) return;
  
  menu.classList.remove('active');
  document.removeEventListener('click', closeContextMenu);
}

/**
 * addToPlaylist(playlistId)
 * - Mục đích: Gửi request thêm track đang được chọn (window.contextTrack) vào playlist.
 * - Params: playlistId (string)
 * - Side-effects: showNotification tuỳ kết quả.
 */
async function addToPlaylist(playlistId) {
  if (!window.contextTrack) {
    showNotification('Lỗi: Không có bài hát được chọn');
    return;
  }
  
  try {
    const res = await fetch(`/playlists/${playlistId}/add-track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: window.contextTrack.id })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showNotification(data.message || 'Đã thêm vào playlist');
    } else {
      showNotification(data.message || 'Thêm thất bại');
    }
  } catch (err) {
    showNotification('Có lỗi xảy ra');
  }
}

/**
 * showNotification(message)
 * - Mục đích: Hiển thị một notification tạm thời ở bottom-center trang.
 * - Params: message (string)
 * - Side-effects: thêm element .custom-notification vào DOM và tự remove sau timeout.
 */
function showNotification(message) {
  const existingNotifs = document.querySelectorAll('.custom-notification');
  existingNotifs.forEach(n => n.remove());
  
  const notif = document.createElement('div');
  notif.className = 'custom-notification';
  notif.style.cssText = `
    position: fixed;
    bottom: 120px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(40, 40, 40, 0.98);
    backdrop-filter: blur(20px);
    color: #fff;
    padding: 16px 28px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 8px 24px rgba(0,0,0,0.8);
    border: 1px solid rgba(30, 215, 96, 0.3);
    animation: slideUp 0.3s ease-out;
  `;
  notif.textContent = message;
  document.body.appendChild(notif);
  
  setTimeout(() => {
    notif.style.transition = 'opacity 0.3s, transform 0.3s';
    notif.style.opacity = '0';
    notif.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => notif.remove(), 300);
  }, 2500);
}

if (!document.getElementById('notif-animations')) {
  const style = document.createElement('style');
  style.id = 'notif-animations';
  style.textContent = `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * initEventListeners()
 * - Mục đích: Đăng ký các event listeners chung của trang (keyboard, contextmenu, form submit shortcut).
 */
function initEventListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCreatePlaylistModal();
    }
  });
  
  const playlistNameInput = document.getElementById('playlistName');
  if (playlistNameInput) {
    playlistNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        createPlaylist();
      }
    });
  }
  
  document.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.track-card');
    if (!card) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const id = card.dataset.trackId;
    const title = card.dataset.trackTitle;
    const artist = card.dataset.trackArtist;
    const cover = card.dataset.trackCover;
    const audioUrl = card.dataset.trackAudio;
    
    showContextMenu(e, id, title, artist, cover, audioUrl);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initResizeSidebar();
  initSearch();
  initEventListeners();
  
  if (userPlaylists && userPlaylists.length > 0) {
    console.log('Using server-side playlists:', userPlaylists.length);
    updatePlaylistSubmenu();
  } else {
    loadPlaylists();
  }
  
  const checkPlayer = setInterval(() => {
    if (window.player) {
      clearInterval(checkPlayer);
    }
  }, 100);
  
  setTimeout(() => clearInterval(checkPlayer), 5000);
});