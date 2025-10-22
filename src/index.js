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
  CommentCollection
} = require('./config');

const uploadRoutes = require('./upload-routes');
const playlistRoutes = require('./playlist-routes');

const app = express();
const SALT_ROUNDS = 10;

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/favicon.ico', (req, res) => res.status(204).end());

const sessionSecret = process.env.SESSION_SECRET || 'dev_secret';
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 },
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || 'mongodb://0.0.0.0:27017/MusicCloud',
    collectionName: 'sessions'
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
    return res.redirect('/login');
  }
  next();
};

// ============================================
// PUBLIC ROUTES
// ============================================

app.get('/', async (req, res) => {
  if (req.session.user) return res.redirect('/profile'); 
  const tracks = await TrackCollection.find().sort({ createdAt: -1 }).limit(12).lean();
  res.render('home', { title: 'MusicCloud - Discover. Get Discovered.', tracks });
});

app.get('/signup', (req, res) => {
  if (req.session.user) {
    req.session.flash = { type: 'info', message: 'Bạn đã đăng nhập rồi.' };
    return res.redirect('/');
  }
  res.render('signup', { title: 'Create account' });
});

app.post('/signup', async (req, res) => {
  if (req.session.user) return res.redirect('/');

  try {
    const { name, username, email, password } = req.body;
    
    if (!name || !username || !email || !password) {
      req.session.flash = { type: 'danger', message: 'Vui lòng điền đầy đủ thông tin.' };
      return res.redirect('/signup');
    }
    
    const exists = await UserCollection.findOne({ $or: [{ email }, { username }] });
    if (exists) {
      req.session.flash = { type: 'warning', message: 'Email hoặc username đã tồn tại.' };
      return res.redirect('/signup');
    }
    
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await UserCollection.create({ name, username, email, passwordHash });
    
    req.session.flash = { 
      type: 'success', 
      message: 'Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.' 
    };
    res.redirect('/login');
    
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'danger', message: 'Đăng ký thất bại. Vui lòng thử lại.' };
    res.redirect('/signup');
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
      return res.redirect('/login'); 
    }
    
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) { 
      req.session.flash = { type: 'danger', message: 'Sai thông tin đăng nhập.' }; 
      return res.redirect('/login'); 
    }
    
    req.session.user = { id: user._id, name: user.name, username: user.username };
    res.redirect('/profile');
    
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'danger', message: 'Đã xảy ra lỗi. Vui lòng thử lại.' };
    res.redirect('/login');
  }
});

const doLogout = (req, res) => req.session.destroy(() => res.redirect('/')); 
app.get('/logout', doLogout);
app.post('/logout', doLogout);

// ============================================
// PROFILE ROUTE WITH SMART RECOMMENDATIONS
// ============================================

app.get(['/me', '/profile'], requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get recently played tracks
    const recentPlays = await PlayHistoryCollection
      .find({ userId })
      .sort({ playedAt: -1 })
      .limit(20)
      .populate('trackId')
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

    // Get user's playlists
    const playlists = await PlaylistCollection
      .find({ userId })
      .populate('tracks')
      .sort({ updatedAt: -1 })
      .limit(6)
      .lean();
    
    // Smart recommendations based on recent listening
    let moreOfWhatYouLike = [];
    
    if (recentlyPlayed.length > 0) {
      // Get the most recent track for recommendations
      const lastTrack = recentlyPlayed[0];
      
      // Find similar tracks based on genres, tags, mood
      const similarTracks = await TrackCollection.find({
        _id: { $ne: lastTrack._id },
        $or: [
          { genres: { $in: lastTrack.genres || [] } },
          { tags: { $in: lastTrack.tags || [] } },
          { mood: lastTrack.mood }
        ]
      }).limit(30).lean();
      
      // Score and sort
      const scoredTracks = similarTracks.map(track => {
        let score = 0;
        
        // Genre match (highest weight)
        const genreMatches = (track.genres || []).filter(g => 
          (lastTrack.genres || []).includes(g)
        ).length;
        score += genreMatches * 3;
        
        // Tag match (medium weight)
        const tagMatches = (track.tags || []).filter(t => 
          (lastTrack.tags || []).includes(t)
        ).length;
        score += tagMatches * 2;
        
        // Mood match (low weight)
        if (track.mood === lastTrack.mood) {
          score += 1;
        }
        
        // Penalize already played tracks
        const wasPlayed = recentlyPlayed.some(r => r._id.toString() === track._id.toString());
        if (wasPlayed) {
          score -= 5;
        }
        
        return { ...track, score };
      });
      
      moreOfWhatYouLike = scoredTracks
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);
    } else {
      // If no history, show random mix
      moreOfWhatYouLike = await TrackCollection
        .aggregate([{ $sample: { size: 12 } }]);
    }

    res.render('profile', {
      title: `@${req.session.user.username} • SAOCLAO`,
      user: req.session.user,
      moreOfWhatYouLike,
      recentlyPlayed,
      playlists  
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// ============================================
// API ROUTES
// ============================================

// Record play history
app.post('/api/plays/:trackId', requireAuth, async (req, res) => {
  try {
    const trackId = req.params.trackId;
    const userId = req.session.user.id;
    await PlayHistoryCollection.create({ userId, trackId, playedAt: new Date() });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

// Get playlists for context menu
app.get('/api/playlists', requireAuth, async (req, res) => {
  try {
    const playlists = await PlaylistCollection.find({ userId: req.session.user.id })
      .select('_id name')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ success: true, playlists });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

// Search tracks
app.get('/api/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    
    console.log('Search query received:', q); // Debug log
    
    if (!q || q.trim().length === 0) {
      return res.json({ success: true, tracks: [] });
    }
    
    const query = q.trim();
    
    // Search by title, artist, genres, or tags
    const tracks = await TrackCollection.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { artist: { $regex: query, $options: 'i' } },
        { genres: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } }
      ]
    })
    .select('_id title artist coverUrl audioUrl genres tags') // Select specific fields
    .limit(20)
    .lean();
    
    console.log('Search results count:', tracks.length); // Debug log
    
    res.json({ success: true, tracks });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ success: false, tracks: [], error: err.message });
  }
});

// Get recommendations based on a track
app.get('/api/recommendations/:trackId', requireAuth, async (req, res) => {
  try {
    const { trackId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    const sourceTrack = await TrackCollection.findById(trackId).lean();
    
    if (!sourceTrack) {
      return res.json({ success: false, message: 'Track not found' });
    }
    
    // Find similar tracks
    const recommendations = await TrackCollection.find({
      _id: { $ne: trackId },
      $or: [
        { genres: { $in: sourceTrack.genres || [] } },
        { tags: { $in: sourceTrack.tags || [] } },
        { mood: sourceTrack.mood }
      ]
    }).limit(limit * 2).lean();
    
    // Score and sort
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
      
      if (track.mood === sourceTrack.mood) {
        score += 1;
      }
      
      return { ...track, score };
    });
    
    const topRecs = scoredRecs
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    res.json({ success: true, recommendations: topRecs, sourceTrack });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Error getting recommendations' });
  }
});

// Get tracks by genre
app.get('/api/tracks/genre/:genre', requireAuth, async (req, res) => {
  try {
    const { genre } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    const tracks = await TrackCollection.find({
      genres: { $regex: new RegExp(genre, 'i') }
    }).limit(limit).lean();
    
    res.json({ success: true, tracks, genre });
  } catch (err) {
    console.error(err);
    res.json({ success: false, tracks: [] });
  }
});

// Get tracks by mood
app.get('/api/tracks/mood/:mood', requireAuth, async (req, res) => {
  try {
    const { mood } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    const tracks = await TrackCollection.find({
      mood: { $regex: new RegExp(mood, 'i') }
    }).limit(limit).lean();
    
    res.json({ success: true, tracks, mood });
  } catch (err) {
    console.error(err);
    res.json({ success: false, tracks: [] });
  }
});

// Get all available genres
app.get('/api/genres', requireAuth, async (req, res) => {
  try {
    const genres = await TrackCollection.distinct('genres');
    res.json({ success: true, genres: genres.sort() });
  } catch (err) {
    console.error(err);
    res.json({ success: false, genres: [] });
  }
});

// Get all available moods
app.get('/api/moods', requireAuth, async (req, res) => {
  try {
    const moods = await TrackCollection.distinct('mood');
    res.json({ success: true, moods: moods.filter(m => m).sort() });
  } catch (err) {
    console.error(err);
    res.json({ success: false, moods: [] });
  }
});

app.get('/track/:id', requireAuth, async (req, res) => {
  try {
    const track = await TrackCollection.findById(req.params.id).lean();
    
    if (!track) {
      return res.status(404).render('404', { title: 'Track not found' });
    }
    
    // Get comments
    const comments = await CommentCollection
      .find({ trackId: req.params.id })
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .lean();
    
    // Get related tracks (same genre)
    const relatedTracks = await TrackCollection.find({
      _id: { $ne: track._id },
      genres: { $in: track.genres || [] }
    })
    .limit(5)
    .select('_id title artist coverUrl genres plays likes')
    .lean();
    
    // Get playlists containing this track
    const playlists = await PlaylistCollection.find({
      tracks: track._id
    })
    .populate('userId', 'username')
    .limit(3)
    .select('_id name coverUrl userId')
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
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Like track
app.post('/api/tracks/:id/like', requireAuth, async (req, res) => {
  try {
    const track = await TrackCollection.findById(req.params.id);
    if (!track) return res.json({ success: false });
    
    track.likes = (track.likes || 0) + 1;
    await track.save();
    
    res.json({ success: true, likes: track.likes });
  } catch (err) {
    res.json({ success: false });
  }
});

// Add comment
app.post('/api/tracks/:id/comments', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    
    const comment = await CommentCollection.create({
      trackId: req.params.id,
      userId: req.session.user.id,
      text
    });
    
    res.json({ success: true, comment });
  } catch (err) {
    res.json({ success: false });
  }
});

// ============================================
// MOUNTED ROUTES
// ============================================

app.use('/upload', uploadRoutes);
app.use('/playlists', playlistRoutes);

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res) => res.status(404).render('404', { title: 'Not found' }));

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('MusicCloud v2.0');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Features: Smart Recommendations, Genre/Mood Filtering');
});