const express = require('express');
const { PlaylistCollection } = require('../config/db');
const router = express.Router();

/**
 * Middleware: requireAuth
 * - Mục đích: Bảo vệ các route chỉ cho user đã đăng nhập truy cập.
 * - Input: req.session.user phải tồn tại.
 * - Nếu không có session user: set flash message và redirect về /login.
 * - Nếu có: gọi next() để tiếp tục xử lý.
 */
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.flash = { type: 'warning', message: 'Vui lòng đăng nhập.' };
    return res.redirect('/login');
  }
  next();
};


/**
 * GET /playlists/
 * - Mục đích: Hiển thị trang playlist của user đang đăng nhập.
 * - Auth: requireAuth (bắt buộc phải đăng nhập).
 * - Tác vụ: lấy tất cả playlist của user (populate tracks), render view 'playlists'.
 * - Output: HTML page hoặc 500 khi có lỗi server.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const playlists = await PlaylistCollection.find({ userId })
      .populate('tracks')
      .sort({ updatedAt: -1 })
      .lean();

    res.render('playlists', {
      title: 'Playlist của tôi - SAOCLAO',
      user: req.session.user,
      playlists
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});


/**
 * GET /playlists/api/mine
 * - Mục đích: API trả về danh sách playlist của user hiện tại (dùng khi thêm bài vào playlist).
 * - Auth: requireAuth
 * - Query params: trackId (tuỳ chọn) — để đánh dấu playlist đã chứa track đó hay chưa (hasTrack boolean).
 * - Response: JSON { success: true, playlists: [{ _id, name, isPublic, hasTrack }] }
 */
router.get('/api/mine', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const playlists = await PlaylistCollection.find({ userId })
      .select('_id name isPublic tracks updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      success: true,
      playlists: playlists.map(p => ({
        _id: p._id,
        name: p.name,
        isPublic: p.isPublic,
        hasTrack: (p.tracks || []).some(t => t?.toString() === req.query.trackId)
      }))
    });
  } catch (err) {
    console.error('Get my playlists error:', err);
    res.status(500).json({ success: false, message: 'Không tải được playlist' });
  }
});

/**
 * GET /playlists/:id
 * - Mục đích: Hiển thị trang chi tiết playlist.
 * - Auth: requireAuth
 * - Behavior: tìm playlist theo id, xử lý quyền truy cập (public/private), lọc track không hợp lệ nếu cần.
 * - Output: render 'playlist-detail' hoặc redirect với flash khi không hợp lệ.
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const playlist = await PlaylistCollection.findById(req.params.id)
      .populate('tracks')
      .populate('userId', 'username name')
      .lean();

    if (!playlist) {
      req.session.flash = { type: 'danger', message: 'Không tìm thấy playlist.' };
      return res.redirect('/playlists');
    }

    const playlistOwnerId = playlist.userId?._id?.toString?.() || playlist.userId?.toString?.();
    const isOwner = playlistOwnerId === userId.toString();
    if (!playlist.isPublic && !isOwner) {
      req.session.flash = { type: 'danger', message: 'Playlist này ở chế độ riêng tư.' };
      return res.redirect('/playlists');
    }

    if (!isOwner) {
      const baseFilter = { status: 'approved', deletedAt: null };
      playlist.tracks = (playlist.tracks || []).filter(t => t && (!t.status || t.status === baseFilter.status) && !t.deletedAt);
    }

    res.render('playlist-detail', {
      title: `${playlist.name} - SAOCLAO`,
      user: req.session.user,
      playlist,
      isOwner
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

/**
 * POST /playlists/create
 * - Mục đích: Tạo playlist mới cho user đang đăng nhập.
 * - Auth: requireAuth
 * - Body: { name, description, isPublic }
 * - Validation: name bắt buộc.
 * - Response: JSON { success: true, playlist: { _id, name, isPublic } } hoặc lỗi.
 */
router.post('/create', requireAuth, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const userId = req.session.user.id;

    if (!name || !name.trim()) {
      return res.json({ success: false, message: 'Tên playlist không được để trống' });
    }

    const playlist = await PlaylistCollection.create({
      name: name.trim(),
      description: description?.trim() || '',
      userId,
      tracks: [],
      isPublic: !!isPublic
    });

    res.json({ success: true, playlist: { _id: playlist._id, name: playlist.name, isPublic: playlist.isPublic } });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Tạo playlist thất bại' });
  }
});

/**
 * POST /playlists/:id/add-track
 * - Mục đích: Thêm một track vào playlist (chỉ owner mới được thực hiện).
 * - Auth: requireAuth
 * - Body: { trackId }
 * - Steps: kiểm tra trackId, kiểm tra playlist thuộc user, kiểm tra track tồn tại, tránh trùng lặp, lưu playlist.
 */
router.post('/:id/add-track', requireAuth, async (req, res) => {
  try {
    const { trackId } = req.body;
    const userId = req.session.user.id;
    const playlistId = req.params.id;

    if (!trackId) {
      return res.json({ success: false, message: 'Thiếu trackId' });
    }

    const playlist = await PlaylistCollection.findOne({ _id: playlistId, userId });

    if (!playlist) {
      return res.json({ success: false, message: 'Không tìm thấy playlist' });
    }

    const trackExists = await PlaylistCollection.db.model('Track').exists({ _id: trackId, deletedAt: null });
    if (!trackExists) {
      return res.json({ success: false, message: 'Track không hợp lệ hoặc đã bị xóa' });
    }

    const alreadyIn = playlist.tracks.some(id => id.toString() === trackId.toString());
    if (alreadyIn) {
      return res.json({ success: false, message: 'Bài hát đã có trong playlist' });
    }

    playlist.tracks.push(trackId);
    playlist.updatedAt = new Date();
    await playlist.save();

    res.json({ success: true, message: 'Đã thêm vào playlist' });
  } catch (err) {
    console.error('Add track to playlist error:', err);
    res.json({ success: false, message: 'Thêm bài hát thất bại' });
  }
});

/**
 * POST /playlists/:id/remove-track
 * - Mục đích: Xóa một track khỏi playlist của user.
 * - Auth: requireAuth
 * - Body: { trackId }
 * - Behavior: tìm playlist thuộc user, loại bỏ trackId khỏi mảng tracks, lưu thay đổi.
 */
router.post('/:id/remove-track', requireAuth, async (req, res) => {
  try {
    const { trackId } = req.body;
    const userId = req.session.user.id;
    const playlistId = req.params.id;

    const playlist = await PlaylistCollection.findOne({ _id: playlistId, userId });

    if (!playlist) {
      return res.json({ success: false, message: 'Không tìm thấy playlist' });
    }

    playlist.tracks = playlist.tracks.filter(id => id.toString() !== trackId);
    playlist.updatedAt = new Date();
    await playlist.save();

    res.json({ success: true, message: 'Đã xóa khỏi playlist' });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Xóa bài hát thất bại' });
  }
});

/**
 * POST /playlists/:id/delete
 * - Mục đích: Xóa hẳn playlist (chỉ owner).
 * - Auth: requireAuth
 * - Response: JSON { success: true } hoặc lỗi nếu playlist không tồn tại.
 */
router.post('/:id/delete', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const playlistId = req.params.id;

    const result = await PlaylistCollection.deleteOne({ _id: playlistId, userId });

    if (result.deletedCount === 0) {
      return res.json({ success: false, message: 'Không tìm thấy playlist' });
    }

    res.json({ success: true, message: 'Đã xóa playlist' });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Xóa playlist thất bại' });
  }
});

/**
 * POST /playlists/:id/update
 * - Mục đích: Cập nhật metadata của playlist (name, description, isPublic).
 * - Auth: requireAuth
 * - Body: { name?, description?, isPublic? }
 * - Response: JSON { success: true, isPublic } hoặc lỗi.
 */
router.post('/:id/update', requireAuth, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const userId = req.session.user.id;
    const playlistId = req.params.id;

    const playlist = await PlaylistCollection.findOne({ _id: playlistId, userId });

    if (!playlist) {
      return res.json({ success: false, message: 'Không tìm thấy playlist' });
    }

    if (name && name.trim()) {
      playlist.name = name.trim();
    }
    playlist.description = description?.trim() || '';
    if (typeof isPublic !== 'undefined') {
      playlist.isPublic = !!isPublic;
    }
    playlist.updatedAt = new Date();
    await playlist.save();

    res.json({ success: true, message: 'Đã cập nhật playlist', isPublic: playlist.isPublic });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Cập nhật thất bại' });
  }
});

/**
 * POST /playlists/:id/visibility
 * - Mục đích: Thay đổi chế độ public/private của playlist.
 * - Auth: requireAuth
 * - Body: { isPublic }
 * - Response: JSON { success: true, isPublic }
 */
router.post('/:id/visibility', requireAuth, async (req, res) => {
  try {
    const { isPublic } = req.body;
    const userId = req.session.user.id;
    const playlist = await PlaylistCollection.findOne({ _id: req.params.id, userId });

    if (!playlist) {
      return res.json({ success: false, message: 'Không tìm thấy playlist' });
    }

    playlist.isPublic = !!isPublic;
    playlist.updatedAt = new Date();
    await playlist.save();

    res.json({ success: true, isPublic: playlist.isPublic });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Không thể cập nhật chế độ công khai' });
  }
});

module.exports = router;
