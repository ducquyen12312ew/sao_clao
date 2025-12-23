const express = require('express');
const { PlaylistCollection } = require('../config/db');
const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.flash = { type: 'warning', message: 'Vui lòng đăng nhập.' };
    return res.redirect('/login');
  }
  next();
};

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

// API: lấy playlist của user (để thêm bài hát)
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

router.post('/:id/add-track', requireAuth, async (req, res) => {
  try {
    const { trackId } = req.body;
    const userId = req.session.user.id;
    const playlistId = req.params.id;

    const playlist = await PlaylistCollection.findOne({ _id: playlistId, userId });

    if (!playlist) {
      return res.json({ success: false, message: 'Không tìm thấy playlist' });
    }

    if (!trackId) {
      return res.json({ success: false, message: 'Thiếu trackId' });
    }

    if (playlist.tracks.some(id => id.toString() === trackId)) {
      return res.json({ success: false, message: 'Bài hát đã có trong playlist' });
    }

    playlist.tracks.push(trackId);
    playlist.updatedAt = new Date();
    await playlist.save();

    res.json({ success: true, message: 'Đã thêm vào playlist' });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Thêm bài hát thất bại' });
  }
});

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
