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

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const playlist = await PlaylistCollection.findOne({
      _id: req.params.id,
      userId
    }).populate('tracks').lean();

    if (!playlist) {
      req.session.flash = { type: 'danger', message: 'Không tìm thấy playlist.' };
      return res.redirect('/playlists');
    }

    res.render('playlist-detail', {
      title: `${playlist.name} - SAOCLAO`,
      user: req.session.user,
      playlist
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.post('/create', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.session.user.id;

    if (!name || !name.trim()) {
      return res.json({ success: false, message: 'Tên playlist không được để trống' });
    }

    const playlist = await PlaylistCollection.create({
      name: name.trim(),
      description: description?.trim() || '',
      userId,
      tracks: []
    });

    res.json({ success: true, playlist: { _id: playlist._id, name: playlist.name } });
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

    if (playlist.tracks.includes(trackId)) {
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
    const { name, description } = req.body;
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
    playlist.updatedAt = new Date();
    await playlist.save();

    res.json({ success: true, message: 'Đã cập nhật playlist' });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Cập nhật thất bại' });
  }
});

module.exports = router;
