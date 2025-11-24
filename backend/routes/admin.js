const express = require('express');
const { TrackCollection, CommentCollection, UserCollection, ReportCollection } = require('../config/db');

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.session.flash = { type: 'danger', message: 'Access denied' };
    return res.redirect('/');
  }
  next();
};
//dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const pendingTracks = await TrackCollection
      .find({ status: 'pending', deletedAt: null })
      .populate('userId', 'username name avatarUrl')
      .sort({ createdAt: -1 })
      .lean();

    const stats = {
      pending: await TrackCollection.countDocuments({ status: 'pending', deletedAt: null }),
      approved: await TrackCollection.countDocuments({ status: 'approved', deletedAt: null }),
      rejected: await TrackCollection.countDocuments({ status: 'rejected', deletedAt: null }),
      deleted: await TrackCollection.countDocuments({ deletedAt: { $ne: null } }),
      reports: await ReportCollection.countDocuments({ status: 'pending' })
    };

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.session.user,
      tracks: pendingTracks,
      stats
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});
//sẻarch tracks
router.get('/search', requireAdmin, async (req, res) => {
  try {
    const { q, status } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.redirect('/admin/dashboard');
    }
    
    let filter = {
      deletedAt: null,
      $or: [
        { title: { $regex: q.trim(), $options: 'i' } },
        { artist: { $regex: q.trim(), $options: 'i' } }
      ]
    };
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    const tracks = await TrackCollection
      .find(filter)
      .populate('userId', 'username name avatarUrl')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const stats = {
      pending: await TrackCollection.countDocuments({ status: 'pending', deletedAt: null }),
      approved: await TrackCollection.countDocuments({ status: 'approved', deletedAt: null }),
      rejected: await TrackCollection.countDocuments({ status: 'rejected', deletedAt: null }),
      deleted: await TrackCollection.countDocuments({ deletedAt: { $ne: null } }),
      reports: await ReportCollection.countDocuments({ status: 'pending' })
    };

    res.render('admin/search', {
      title: 'Search Results - Admin',
      user: req.session.user,
      tracks,
      stats,
      searchQuery: q,
      currentStatus: status || 'all'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});
//reports list
router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    let filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    const reports = await ReportCollection
      .find(filter)
      .populate('trackId', 'title artist coverUrl audioUrl status')
      .populate('reporterId', 'username name avatarUrl')
      .populate('reviewedBy', 'username name')
      .sort({ createdAt: -1 })
      .lean();

    const stats = {
      pending: await ReportCollection.countDocuments({ status: 'pending' }),
      reviewed: await ReportCollection.countDocuments({ status: 'reviewed' }),
      resolved: await ReportCollection.countDocuments({ status: 'resolved' }),
      dismissed: await ReportCollection.countDocuments({ status: 'dismissed' })
    };

    res.render('admin/reports', {
      title: 'Reports - Admin',
      user: req.session.user,
      reports,
      stats,
      currentStatus: status || 'all'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});
//deleted tracks list
router.get('/deleted', requireAdmin, async (req, res) => {
  try {
    const deletedTracks = await TrackCollection
      .find({ deletedAt: { $ne: null } })
      .populate('userId', 'username name avatarUrl')
      .sort({ deletedAt: -1 })
      .lean();

    const stats = {
      pending: await TrackCollection.countDocuments({ status: 'pending', deletedAt: null }),
      approved: await TrackCollection.countDocuments({ status: 'approved', deletedAt: null }),
      rejected: await TrackCollection.countDocuments({ status: 'rejected', deletedAt: null }),
      deleted: await TrackCollection.countDocuments({ deletedAt: { $ne: null } }),
      reports: await ReportCollection.countDocuments({ status: 'pending' })
    };

    res.render('admin/deleted', {
      title: 'Deleted Tracks',
      user: req.session.user,
      tracks: deletedTracks,
      stats
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});
//track approval
router.post('/tracks/:id/approve', requireAdmin, async (req, res) => {
  try {
    await TrackCollection.findByIdAndUpdate(req.params.id, { 
      status: 'approved',
      reportCount: 0 
    });
    
    // Dismiss all pending reports for this track
    await ReportCollection.updateMany(
      { trackId: req.params.id, status: 'pending' },
      { 
        status: 'dismissed',
        reviewedAt: new Date(),
        reviewedBy: req.session.user.id,
        adminNote: 'Track approved'
      }
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tracks/:id/reject', requireAdmin, async (req, res) => {
  try {
    await TrackCollection.findByIdAndUpdate(req.params.id, { status: 'rejected' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/tracks/:id', requireAdmin, async (req, res) => {
  try {
    await TrackCollection.findByIdAndUpdate(req.params.id, { 
      deletedAt: new Date() 
    });
    
    // Mark all reports as resolved
    await ReportCollection.updateMany(
      { trackId: req.params.id, status: 'pending' },
      { 
        status: 'resolved',
        reviewedAt: new Date(),
        reviewedBy: req.session.user.id,
        adminNote: 'Track deleted'
      }
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tracks/:id/restore', requireAdmin, async (req, res) => {
  try {
    await TrackCollection.findByIdAndUpdate(req.params.id, { deletedAt: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
//report management
router.post('/reports/:id/dismiss', requireAdmin, async (req, res) => {
  try {
    const { adminNote } = req.body;
    
    await ReportCollection.findByIdAndUpdate(req.params.id, {
      status: 'dismissed',
      reviewedAt: new Date(),
      reviewedBy: req.session.user.id,
      adminNote: adminNote || 'Dismissed by admin'
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/reports/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const { adminNote } = req.body;
    
    await ReportCollection.findByIdAndUpdate(req.params.id, {
      status: 'resolved',
      reviewedAt: new Date(),
      reviewedBy: req.session.user.id,
      adminNote: adminNote || 'Resolved'
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
//comment management
router.delete('/comments/:id', requireAdmin, async (req, res) => {
  try {
    await CommentCollection.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
