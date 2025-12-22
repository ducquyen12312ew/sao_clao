const express = require('express');
const {
  TrackCollection,
  PlaylistCollection,
  UserCollection
} = require('../config/db');
<<<<<<< Updated upstream
const { TrackLikeCollection } = require('../config/db');
=======
>>>>>>> Stashed changes

const router = express.Router();

// Middleware to require auth for some endpoints
const requireAuth = (req, res, next) => {
  if (!req.session?.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  next();
};

// GET /api/home - latest approved tracks
router.get('/home', async (req, res) => {
  try {
    const tracks = await TrackCollection.find({ status: 'approved', deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();
    res.json({ success: true, tracks });
  } catch (err) {
    console.error('API /home error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/tracks/:id - track details
router.get('/tracks/:id', async (req, res) => {
  try {
    const track = await TrackCollection.findById(req.params.id).lean();
    if (!track) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, track });
  } catch (err) {
    console.error('API /tracks/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/playlists/:id - playlist details
router.get('/playlists/:id', async (req, res) => {
  try {
    const playlist = await PlaylistCollection.findById(req.params.id).populate('tracks').populate('userId', 'username name').lean();
    if (!playlist) return res.status(404).json({ success: false, message: 'Not found' });

    // Filter tracks for public viewers
    const isOwner = req.session?.user?.id && playlist.userId && (playlist.userId._id || playlist.userId).toString() === req.session.user.id.toString();
    if (!isOwner) {
      playlist.tracks = (playlist.tracks || []).filter(t => t && (!t.status || t.status === 'approved') && !t.deletedAt);
    }

    res.json({ success: true, playlist, isOwner });
  } catch (err) {
    console.error('API /playlists/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/playlists - current user's playlists (requires auth)
router.get('/playlists', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const playlists = await PlaylistCollection.find({ userId })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ success: true, playlists });
  } catch (err) {
    console.error('API /playlists error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/me - current session user
router.get('/me', (req, res) => {
  if (!req.session?.user) return res.json({ success: false, user: null });
  return res.json({ success: true, user: req.session.user });
});

// GET /api/likes - liked tracks for current user
router.get('/likes', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
<<<<<<< Updated upstream
    const likes = await TrackLikeCollection.find({ userId }).populate('trackId').lean();
    const tracks = likes.map(l => l.trackId).filter(Boolean);
    res.json({ success: true, tracks });
=======
    // using TrackLikeCollection would be ideal; fallback: tracks with likes by user not stored
    // For now, return empty or recent tracks (implement later)
    const liked = [];
    res.json({ success: true, tracks: liked });
>>>>>>> Stashed changes
  } catch (err) {
    console.error('API /likes error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

<<<<<<< Updated upstream
// POST /api/tracks/:id/like
router.post('/tracks/:id/like', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const trackId = req.params.id;
    const exists = await TrackLikeCollection.findOne({ userId, trackId });
    if (exists) return res.json({ success: true });
    await TrackLikeCollection.create({ userId, trackId });
    await TrackCollection.findByIdAndUpdate(trackId, { $inc: { likes: 1 } });
    res.json({ success: true });
  } catch (err) {
    console.error('API like error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/tracks/:id/unlike
router.post('/tracks/:id/unlike', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const trackId = req.params.id;
    const del = await TrackLikeCollection.findOneAndDelete({ userId, trackId });
    if (del) await TrackCollection.findByIdAndUpdate(trackId, { $inc: { likes: -1 } });
    res.json({ success: true });
  } catch (err) {
    console.error('API unlike error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

=======
>>>>>>> Stashed changes
// GET /api/settings - simple settings payload
router.get('/settings', requireAuth, (req, res) => {
  const defaults = { allowUploads: true };
  res.json({ success: true, settings: defaults });
});

// GET /api/users/:username - user profile public data
router.get('/users/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await UserCollection.findOne({ username }).select('-passwordHash -email').lean();
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });

    const tracks = await TrackCollection.find({ userId: user._id, deletedAt: null }).sort({ createdAt: -1 }).limit(12).lean();
    const playlists = await PlaylistCollection.find({ userId: user._id, isPublic: true }).limit(6).lean();
    const totalPlays = tracks.reduce((s, t) => s + (t.playCount || 0), 0);
    const totalLikes = tracks.reduce((s, t) => s + (t.likes || 0), 0);

    res.json({ success: true, profileUser: user, tracks, playlists, totalPlays, totalLikes });
  } catch (err) {
    console.error('API /users/:username error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/dashboard - admin stats and pending tracks (requires admin)
router.get('/admin/dashboard', requireAuth, async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const pendingTracks = await TrackCollection.find({ status: 'pending', deletedAt: null }).populate('userId', 'username name avatarUrl').sort({ createdAt: -1 }).lean();
    const stats = {
      pending: await TrackCollection.countDocuments({ status: 'pending', deletedAt: null }),
      approved: await TrackCollection.countDocuments({ status: 'approved', deletedAt: null }),
      rejected: await TrackCollection.countDocuments({ status: 'rejected', deletedAt: null }),
      deleted: await TrackCollection.countDocuments({ deletedAt: { $ne: null } })
    };
    res.json({ success: true, stats, tracks: pendingTracks });
  } catch (err) {
    console.error('API /admin/dashboard error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/reports - list reports
router.get('/admin/reports', requireAuth, async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    const reports = await require('../config/db').ReportCollection.find(filter).populate('trackId', 'title artist coverUrl audioUrl status').populate('reporterId', 'username name avatarUrl').populate('reviewedBy', 'username name').sort({ createdAt: -1 }).lean();
    res.json({ success: true, reports });
  } catch (err) {
    console.error('API /admin/reports error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/deleted - deleted tracks list
router.get('/admin/deleted', requireAuth, async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const deleted = await require('../config/db').TrackCollection.find({ deletedAt: { $ne: null } }).populate('userId', 'username name avatarUrl').sort({ deletedAt: -1 }).lean();
    res.json({ success: true, tracks: deleted });
  } catch (err) {
    console.error('API /admin/deleted error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/search?q=...&status=... - search tracks for admin
router.get('/admin/search', requireAuth, async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const { q, status } = req.query;
    if (!q || q.trim().length === 0) return res.json({ success: true, tracks: [] });
    let filter = { deletedAt: null, $or: [{ title: { $regex: q.trim(), $options: 'i' } }, { artist: { $regex: q.trim(), $options: 'i' } }] };
    if (status && status !== 'all') filter.status = status;
    const tracks = await require('../config/db').TrackCollection.find(filter).populate('userId', 'username name avatarUrl').sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, tracks });
  } catch (err) {
    console.error('API /admin/search error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;


