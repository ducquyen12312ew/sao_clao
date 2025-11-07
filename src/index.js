const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

const {
  connectDB,
  TrackCollection,
  UserCollection,
  PlayHistoryCollection,
  PlaylistCollection,
  CommentCollection,
  FollowCollection,
  ReportCollection
} = require('./config');

const uploadRoutes = require('./upload-routes');
const playlistRoutes = require('./playlist-routes');
const userRoutes = require('./user-routes');
const settingsRoutes = require('./settings-routes');
const adminRoutes = require('./admin-routes');

const app = express();
const SALT_ROUNDS = 10;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.get('/favicon.ico', (req, res) => res.status(204).end());

const sessionSecret = process.env.SESSION_SECRET || 'dev_secret_change_in_production';
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    httpOnly: true, 
    secure: false,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7
  },
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/MusicCloud',
    dbName: 'MusicCloud',
    collectionName: 'sessions',
    touchAfter: 24 * 3600,
    crypto: { secret: sessionSecret }
  })
}));

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.flash = { type: 'warning', message: 'Vui lòng đăng nhập.' };
    return req.session.save((err) => {
      res.redirect('/login');
    });
  }
  next();
};

const getTrackFilter = (user) => {
  return user?.role === 'admin' ? {} : { status: 'approved' };
};

app.get('/', async (req, res) => {
  try {
    if (req.session.user) return res.redirect('/profile');
    
    const tracks = await TrackCollection
      .find({ status: 'approved', deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();
    
    res.render('home', { 
      title: 'MusicCloud - Discover. Get Discovered.', 
      tracks 
    });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

app.get('/signup', (req, res) => {
  if (req.session.user) {
    req.session.flash = { type: 'info', message: 'Bạn đã đăng nhập rồi.' };
    return req.session.save(() => res.redirect('/'));
  }
  res.render('signup', { title: 'Create account' });
});

app.post('/signup', async (req, res) => {
  if (req.session.user) return res.redirect('/');

  try {
    const { name, username, email, password } = req.body;
    
    if (!name || !username || !email || !password) {
      req.session.flash = { type: 'danger', message: 'Vui lòng điền đầy đủ thông tin.' };
      return req.session.save(() => res.redirect('/signup'));
    }
    
    const exists = await UserCollection.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (exists) {
      req.session.flash = { type: 'warning', message: 'Email hoặc username đã tồn tại.' };
      return req.session.save(() => res.redirect('/signup'));
    }
    
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await UserCollection.create({ name, username, email, passwordHash });
    
    req.session.flash = { type: 'success', message: 'Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.' };
    req.session.save(() => res.redirect('/login'));
    
  } catch (err) {
    req.session.flash = { type: 'danger', message: 'Đăng ký thất bại. Vui lòng thử lại.' };
    req.session.save(() => res.redirect('/signup'));
  }
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/profile');
  res.render('login', { title: 'Sign in' });
});

app.post('/login', async (req, res) => {
  if (req.session.user) return res.redirect('/profile');
  
  try {
    const { identifier, password } = req.body;
    
    const user = await UserCollection.findOne({ 
      $or: [{ email: identifier }, { username: identifier }] 
    });
    
    if (!user) { 
      req.session.flash = { type: 'danger', message: 'Sai thông tin đăng nhập.' }; 
      return req.session.save(() => res.redirect('/login'));
    }
    
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) { 
      req.session.flash = { type: 'danger', message: 'Sai thông tin đăng nhập.' }; 
      return req.session.save(() => res.redirect('/login'));
    }
    
    req.session.user = { 
      id: user._id, 
      name: user.name, 
      username: user.username,
      avatarUrl: user.avatarUrl || '',
      bio: user.bio || '',
      role: user.role || 'user'
    };
    
    if (user.role === 'admin') {
      return req.session.save(() => res.redirect('/admin/dashboard'));
    }
    
    req.session.save(() => res.redirect('/profile'));
    
  } catch (err) {
    req.session.flash = { type: 'danger', message: 'Đã xảy ra lỗi. Vui lòng thử lại.' };
    req.session.save(() => res.redirect('/login'));
  }
});

const doLogout = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
};

app.get('/logout', doLogout);
app.post('/logout', doLogout);

app.use('/upload', uploadRoutes);
app.use('/playlists', playlistRoutes);
app.use('/users', userRoutes);  
app.use('/settings', settingsRoutes);
app.use('/admin', adminRoutes);

app.get(['/me', '/profile'], requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const filter = getTrackFilter(req.session.user);
    const baseFilter = { ...filter, deletedAt: null };

    const recentPlays = await PlayHistoryCollection
      .find({ userId })
      .sort({ playedAt: -1 })
      .limit(20)
      .populate({
        path: 'trackId',
        match: baseFilter
      })
      .lean();
    
    const seenTracks = new Set();
    const recentlyPlayed = [];
    
    for (const doc of recentPlays) {
      if (doc.trackId && !seenTracks.has(doc.trackId._id.toString())) {
        seenTracks.add(doc.trackId._id.toString());
        recentlyPlayed.push(doc.trackId);
        if (recentlyPlayed.length >= 12) break;
      }
    }

    const playlists = await PlaylistCollection
      .find({ userId })
      .populate({
        path: 'tracks',
        match: baseFilter
      })
      .sort({ updatedAt: -1 })
      .limit(6)
      .lean();
    
    let moreOfWhatYouLike = [];
    
    if (recentlyPlayed.length > 0) {
      const lastTrack = recentlyPlayed[0];
      
      const similarTracks = await TrackCollection.find({
        ...baseFilter,
        _id: { $ne: lastTrack._id },
        $or: [
          { genres: { $in: lastTrack.genres || [] } },
          { tags: { $in: lastTrack.tags || [] } },
          { mood: lastTrack.mood }
        ]
      }).limit(30).lean();
      
      const scoredTracks = similarTracks.map(track => {
        let score = 0;
        
        const genreMatches = (track.genres || []).filter(g => 
          (lastTrack.genres || []).includes(g)
        ).length;
        score += genreMatches * 3;
        
        const tagMatches = (track.tags || []).filter(t => 
          (lastTrack.tags || []).includes(t)
        ).length;
        score += tagMatches * 2;
        
        if (track.mood === lastTrack.mood) score += 1;
        
        const wasPlayed = recentlyPlayed.some(r => 
          r._id.toString() === track._id.toString()
        );
        if (wasPlayed) score -= 5;
        
        return { ...track, score };
      });
      
      moreOfWhatYouLike = scoredTracks
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);
    } else {
      moreOfWhatYouLike = await TrackCollection
        .aggregate([
          { $match: baseFilter },
          { $sample: { size: 12 } }
        ]);
    }

    res.render('profile', {
      title: `@${req.session.user.username} • MusicCloud`,
      user: req.session.user,
      moreOfWhatYouLike,
      recentlyPlayed,
      playlists  
    });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

app.post('/api/plays/:trackId', requireAuth, async (req, res) => {
  try {
    const trackId = req.params.trackId;
    const userId = req.session.user.id;
    
    await PlayHistoryCollection.create({ 
      userId, 
      trackId, 
      playedAt: new Date() 
    });
    
    await TrackCollection.findByIdAndUpdate(
      trackId,
      { $inc: { playCount: 1 } }
    );
    
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/playlists', requireAuth, async (req, res) => {
  try {
    const playlists = await PlaylistCollection
      .find({ userId: req.session.user.id })
      .select('_id name')
      .sort({ updatedAt: -1 })
      .lean();
    
    res.json({ success: true, playlists });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.json({ success: true, tracks: [], users: [] });
    }
    
    const query = q.trim();
    const filter = getTrackFilter(req.session.user);
    
    const tracks = await TrackCollection.find({
      ...filter,
      deletedAt: null,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { artist: { $regex: query, $options: 'i' } },
        { genres: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } }
      ]
    })
    .populate('userId', 'username name avatarUrl')
    .select('_id title artist coverUrl audioUrl genres tags userId')
    .limit(20)
    .lean();
    
    const users = await UserCollection.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } }
      ]
    })
    .select('username name avatarUrl followersCount')
    .limit(10)
    .lean();
    
    const usersWithTrackCount = await Promise.all(
      users.map(async (user) => {
        const trackCount = await TrackCollection.countDocuments({ 
          userId: user._id,
          ...filter,
          deletedAt: null
        });
        return { ...user, trackCount };
      })
    );
    
    res.json({ 
      success: true, 
      tracks,
      users: usersWithTrackCount
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      tracks: [], 
      users: [], 
      error: err.message 
    });
  }
});

app.get('/api/recommendations/:trackId', requireAuth, async (req, res) => {
  try {
    const { trackId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const filter = getTrackFilter(req.session.user);
    
    const sourceTrack = await TrackCollection.findById(trackId).lean();
    
    if (!sourceTrack) {
      return res.json({ success: false, message: 'Track not found' });
    }
    
    const recommendations = await TrackCollection.find({
      ...filter,
      deletedAt: null,
      _id: { $ne: trackId },
      $or: [
        { genres: { $in: sourceTrack.genres || [] } },
        { tags: { $in: sourceTrack.tags || [] } },
        { mood: sourceTrack.mood }
      ]
    }).limit(limit * 2).lean();
    
    const scoredRecs = recommendations.map(track => {
      let score = 0;
      
      const genreMatches = (track.genres || []).filter(g => 
        (sourceTrack.genres || []).includes(g)
      ).length;
      score += genreMatches * 3;
      
      const tagMatches = (track.tags || []).filter(t => 
        (sourceTrack.tags || []).includes(t)
      ).length;
      score += tagMatches * 2;
      
      if (track.mood === sourceTrack.mood) score += 1;
      
      return { ...track, score };
    });
    
    const topRecs = scoredRecs
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    res.json({ success: true, recommendations: topRecs, sourceTrack });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Error getting recommendations',
      error: err.message 
    });
  }
});

app.get('/api/tracks/genre/:genre', requireAuth, async (req, res) => {
  try {
    const { genre } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const filter = getTrackFilter(req.session.user);
    
    const tracks = await TrackCollection.find({
      ...filter,
      deletedAt: null,
      genres: { $regex: new RegExp(genre, 'i') }
    }).limit(limit).lean();
    
    res.json({ success: true, tracks, genre });
  } catch (err) {
    res.status(500).json({ success: false, tracks: [], error: err.message });
  }
});

app.get('/api/tracks/mood/:mood', requireAuth, async (req, res) => {
  try {
    const { mood } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const filter = getTrackFilter(req.session.user);
    
    const tracks = await TrackCollection.find({
      ...filter,
      deletedAt: null,
      mood: { $regex: new RegExp(mood, 'i') }
    }).limit(limit).lean();
    
    res.json({ success: true, tracks, mood });
  } catch (err) {
    res.status(500).json({ success: false, tracks: [], error: err.message });
  }
});

app.get('/api/genres', requireAuth, async (req, res) => {
  try {
    const filter = getTrackFilter(req.session.user);
    const tracks = await TrackCollection.find({ ...filter, deletedAt: null }).select('genres').lean();
    const genresSet = new Set();
    tracks.forEach(t => (t.genres || []).forEach(g => genresSet.add(g)));
    const genres = Array.from(genresSet).filter(g => g).sort();
    res.json({ success: true, genres });
  } catch (err) {
    res.status(500).json({ success: false, genres: [], error: err.message });
  }
});

app.get('/api/moods', requireAuth, async (req, res) => {
  try {
    const filter = getTrackFilter(req.session.user);
    const moods = await TrackCollection.distinct('mood', { ...filter, deletedAt: null });
    res.json({ success: true, moods: moods.filter(m => m).sort() });
  } catch (err) {
    res.status(500).json({ success: false, moods: [], error: err.message });
  }
});

app.get('/api/search/users', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.json({ success: true, users: [] });
    }
    
    const users = await UserCollection.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } }
      ]
    })
    .select('username name avatarUrl followersCount')
    .limit(10)
    .lean();
    
    res.json({ success: true, users });
  } catch (err) {
    res.json({ success: false, users: [], error: err.message });
  }
});

app.get('/track/:id', requireAuth, async (req, res) => {
  try {
    const filter = getTrackFilter(req.session.user);
    const track = await TrackCollection.findOne({
      _id: req.params.id,
      deletedAt: null,
      ...filter
    })
    .populate('userId', 'username name')  
    .lean();
    
    if (!track) {
      return res.status(404).render('404', { title: 'Track not found' });
    }
    
    const comments = await CommentCollection
      .find({ trackId: req.params.id })
      .populate('userId', 'username avatarUrl')
      .sort({ createdAt: -1 })
      .lean();
    
    const relatedTracks = await TrackCollection.find({
      ...filter,
      deletedAt: null,
      _id: { $ne: track._id },
      genres: { $in: track.genres || [] }
    })
    .limit(5)
    .select('_id title artist coverUrl genres playCount')
    .lean();
    
    const playlists = await PlaylistCollection.find({
      tracks: track._id
    })
    .populate('userId', 'username')
    .limit(3)
    .select('_id name userId')
    .lean();
    
    res.render('track-detail', {
      title: `${track.title} - ${track.artist}`,
      track,
      comments,
      relatedTracks,
      playlists,
      user: req.session.user
    });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

app.post('/api/tracks/:id/like', requireAuth, async (req, res) => {
  try {
    const track = await TrackCollection.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    
    if (!track) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }
    
    res.json({ success: true, likes: track.likes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/tracks/:id/comments', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Comment cannot be empty' 
      });
    }
    
    const comment = await CommentCollection.create({
      trackId: req.params.id,
      userId: req.session.user.id,
      text: text.trim()
    });
    
    const populatedComment = await CommentCollection
      .findById(comment._id)
      .populate('userId', 'username avatarUrl')
      .lean();
    
    res.json({ success: true, comment: populatedComment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE COMMENT - ADMIN ONLY (NEW!)
app.delete('/api/comments/:id', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ admin mới có quyền xóa comment' 
      });
    }
    
    const commentId = req.params.id;
    
    const comment = await CommentCollection.findByIdAndDelete(commentId);
    
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Comment không tồn tại' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Đã xóa comment' 
    });
    
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Có lỗi xảy ra' 
    });
  }
});

app.post('/api/tracks/:id/report', requireAuth, async (req, res) => {
  try {
    const { reason, description } = req.body;
    const trackId = req.params.id;
    const reporterId = req.session.user.id;
    
    const track = await TrackCollection.findById(trackId);
    if (!track) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }
    
    const existingReport = await ReportCollection.findOne({
      trackId,
      reporterId,
      status: 'pending'
    });
    
    if (existingReport) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bạn đã báo cáo bài hát này rồi' 
      });
    }
    
    await ReportCollection.create({
      trackId,
      reporterId,
      reason,
      description: description?.trim() || ''
    });
    
    await TrackCollection.findByIdAndUpdate(trackId, {
      $inc: { reportCount: 1 }
    });
    
    res.json({ 
      success: true, 
      message: 'Đã gửi báo cáo. Admin sẽ xem xét trong thời gian sớm nhất.' 
    });
    
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ success: false, message: 'Có lỗi xảy ra' });
  }
});

app.get('/api/admin/notifications/count', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false });
    }
    
    const pendingReports = await ReportCollection.countDocuments({ 
      status: 'pending' 
    });
    
    const pendingTracks = await TrackCollection.countDocuments({ 
      status: 'pending',
      deletedAt: null 
    });
    
    res.json({ 
      success: true, 
      count: pendingReports + pendingTracks,
      reports: pendingReports,
      tracks: pendingTracks
    });
    
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.use((req, res) => {
  res.status(404).render('404', { title: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server on port ${PORT}`);
      console.log(`Host: 0.0.0.0`);
    });
    
  } catch (err) {
    console.error('Server start error:', err);
    process.exit(1);
  }
}

startServer();