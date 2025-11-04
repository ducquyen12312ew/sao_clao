const express = require('express');
const { TrackCollection, CommentCollection, UserCollection } = require('./config');

const router = express.Router();

// Middleware admin
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.session.flash = { type: 'danger', message: 'Access denied' };
    return res.redirect('/');
  }
  next();
};

// Dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const pendingTracks = await TrackCollection.countDocuments({ status: 'pending' });
    const totalTracks = await TrackCollection.countDocuments();
    const totalUsers = await UserCollection.countDocuments();
    const totalComments = await CommentCollection.countDocuments();

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.session.user,
      stats: { pendingTracks, totalTracks, totalUsers, totalComments }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Quan ly tracks
router.get('/tracks', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    
    const tracks = await TrackCollection
      .find(filter)
      .populate('userId', 'username name')
      .sort({ createdAt: -1 })
      .lean();

    res.render('admin/tracks', {
      title: 'Track Management',
      user: req.session.user,
      tracks,
      currentStatus: status || 'all'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Duyet track
router.post('/tracks/:id/approve', requireAdmin, async (req, res) => {
  try {
    await TrackCollection.findByIdAndUpdate(req.params.id, { status: 'approved' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Tu choi track
router.post('/tracks/:id/reject', requireAdmin, async (req, res) => {
  try {
    await TrackCollection.findByIdAndUpdate(req.params.id, { status: 'rejected' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Xoa track
router.delete('/tracks/:id', requireAdmin, async (req, res) => {
  try {
    await TrackCollection.findByIdAndDelete(req.params.id);
    await CommentCollection.deleteMany({ trackId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Quan ly comments
router.get('/comments', requireAdmin, async (req, res) => {
  try {
    const comments = await CommentCollection
      .find()
      .populate('userId', 'username name')
      .populate('trackId', 'title')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.render('admin/comments', {
      title: 'Comment Management',
      user: req.session.user,
      comments
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Xoa comment
router.delete('/comments/:id', requireAdmin, async (req, res) => {
  try {
    await CommentCollection.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
