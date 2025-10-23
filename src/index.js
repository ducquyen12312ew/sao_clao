const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import database configuration and models
const {
  connectDB,
  TrackCollection,
  UserCollection,
  PlayHistoryCollection,
  PlaylistCollection,
  CommentCollection
} = require('./config');

// Import route modules
const uploadRoutes = require('./upload-routes');
const playlistRoutes = require('./playlist-routes');

// Initialize Express app
const app = express();
const SALT_ROUNDS = 10;

// ============================================
// VIEW ENGINE & STATIC FILES
// ============================================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// ============================================
// MIDDLEWARE
// ============================================

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Favicon handler
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Session configuration - FIXED FOR RENDER
const sessionSecret = process.env.SESSION_SECRET || 'dev_secret_change_in_production';
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    httpOnly: true, 
    secure: false, // IMPORTANT: false for Render (HTTPS is handled by proxy)
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  },
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/MusicCloud',
    dbName: 'MusicCloud',
    collectionName: 'sessions',
    touchAfter: 24 * 3600, // Lazy session update
    crypto: {
      secret: sessionSecret
    }
  })
}));

// Flash messages and user context
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.flash = { type: 'warning', message: 'Vui lòng đăng nhập.' };
    return req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.redirect('/login');
    });
  }
  next();
};

// ============================================
// PUBLIC ROUTES
// ============================================

// Home page
app.get('/', async (req, res) => {
  try {
    if (req.session.user) return res.redirect('/profile');
    
    const tracks = await TrackCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();
    
    res.render('home', { 
      title: 'MusicCloud - Discover. Get Discovered.', 
      tracks 
    });
  } catch (err) {
    console.error('Home page error:', err);
    res.status(500).send('Server error');
  }
});

// Signup page
app.get('/signup', (req, res) => {
  if (req.session.user) {
    req.session.flash = { type: 'info', message: 'Bạn đã đăng nhập rồi.' };
    return req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.redirect('/');
    });
  }
  res.render('signup', { title: 'Create account' });
});

// Signup handler - FIXED WITH SESSION SAVE
app.post('/signup', async (req, res) => {
  if (req.session.user) return res.redirect('/');

  try {
    const { name, username, email, password } = req.body;
    
    console.log('📝 Signup attempt:', { name, username, email });
    
    // Validation
    if (!name || !username || !email || !password) {
      req.session.flash = { 
        type: 'danger', 
        message: 'Vui lòng điền đầy đủ thông tin.' 
      };
      return req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        res.redirect('/signup');
      });
    }
    
    // Check if user exists
    const exists = await UserCollection.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (exists) {
      req.session.flash = { 
        type: 'warning', 
        message: 'Email hoặc username đã tồn tại.' 
      };
      return req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        res.redirect('/signup');
      });
    }
    
    // Create new user
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await UserCollection.create({ name, username, email, passwordHash });
    
    console.log('✅ User created:', newUser._id);
    
    req.session.flash = { 
      type: 'success', 
      message: 'Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.' 
    };
    
    // CRITICAL: Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
        return res.redirect('/signup');
      }
      console.log('✅ Redirecting to /login');
      res.redirect('/login');
    });
    
  } catch (err) {
    console.error('Signup error:', err);
    req.session.flash = { 
      type: 'danger', 
      message: 'Đăng ký thất bại. Vui lòng thử lại.' 
    };
    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.redirect('/signup');
    });
  }
});

// Login page
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/profile');
  res.render('login', { title: 'Sign in' });
});

// Login handler - FIXED WITH SESSION SAVE
app.post('/login', async (req, res) => {
  if (req.session.user) return res.redirect('/profile');
  
  try {
    const { identifier, password } = req.body;
    
    console.log('🔐 Login attempt:', identifier);
    
    // Find user by email or username
    const user = await UserCollection.findOne({ 
      $or: [{ email: identifier }, { username: identifier }] 
    });
    
    if (!user) { 
      console.log('❌ User not found:', identifier);
      req.session.flash = { 
        type: 'danger', 
        message: 'Sai thông tin đăng nhập.' 
      }; 
      return req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        res.redirect('/login');
      });
    }
    
    // Verify password
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) { 
      console.log('❌ Wrong password for:', identifier);
      req.session.flash = { 
        type: 'danger', 
        message: 'Sai thông tin đăng nhập.' 
      }; 
      return req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        res.redirect('/login');
      });
    }
    
    // Set session
    req.session.user = { 
      id: user._id, 
      name: user.name, 
      username: user.username 
    };
    
    console.log('✅ User logged in:', user.username);
    
    // CRITICAL: Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
        req.session.flash = { 
          type: 'danger', 
          message: 'Đã xảy ra lỗi. Vui lòng thử lại.' 
        };
        return res.redirect('/login');
      }
      console.log('✅ Redirecting to /profile');
      res.redirect('/profile');
    });
    
  } catch (err) {
    console.error('Login error:', err);
    req.session.flash = { 
      type: 'danger', 
      message: 'Đã xảy ra lỗi. Vui lòng thử lại.' 
    };
    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.redirect('/login');
    });
  }
});

// Logout handler
const doLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.redirect('/');
  });
};

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
        const wasPlayed = recentlyPlayed.some(r => 
          r._id.toString() === track._id.toString()
        );
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
      title: `@${req.session.user.username} • MusicCloud`,
      user: req.session.user,
      moreOfWhatYouLike,
      recentlyPlayed,
      playlists  
    });
  } catch (err) {
    console.error('Profile page error:', err);
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
    
    await PlayHistoryCollection.create({ 
      userId, 
      trackId, 
      playedAt: new Date() 
    });
    
    // Increment play count
    await TrackCollection.findByIdAndUpdate(
      trackId,
      { $inc: { playCount: 1 } }
    );
    
    res.json({ ok: true });
  } catch (err) {
    console.error('Play history error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get playlists for context menu
app.get('/api/playlists', requireAuth, async (req, res) => {
  try {
    const playlists = await PlaylistCollection
      .find({ userId: req.session.user.id })
      .select('_id name')
      .sort({ updatedAt: -1 })
      .lean();
    
    res.json({ success: true, playlists });
  } catch (err) {
    console.error('Get playlists error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Search tracks
app.get('/api/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    
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
    .select('_id title artist coverUrl audioUrl genres tags')
    .limit(20)
    .lean();
    
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
    console.error('Recommendations error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting recommendations',
      error: err.message 
    });
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
    console.error('Genre tracks error:', err);
    res.status(500).json({ success: false, tracks: [], error: err.message });
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
    console.error('Mood tracks error:', err);
    res.status(500).json({ success: false, tracks: [], error: err.message });
  }
});

// Get all available genres
app.get('/api/genres', requireAuth, async (req, res) => {
  try {
    const genres = await TrackCollection.distinct('genres');
    res.json({ success: true, genres: genres.filter(g => g).sort() });
  } catch (err) {
    console.error('Get genres error:', err);
    res.status(500).json({ success: false, genres: [], error: err.message });
  }
});

// Get all available moods
app.get('/api/moods', requireAuth, async (req, res) => {
  try {
    const moods = await TrackCollection.distinct('mood');
    res.json({ success: true, moods: moods.filter(m => m).sort() });
  } catch (err) {
    console.error('Get moods error:', err);
    res.status(500).json({ success: false, moods: [], error: err.message });
  }
});

// ============================================
// TRACK DETAIL PAGE
// ============================================

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
    .select('_id title artist coverUrl genres playCount')
    .lean();
    
    // Get playlists containing this track
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
    console.error('Track detail error:', err);
    res.status(500).send('Server error');
  }
});

// Like track
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
    console.error('Like track error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add comment
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
      .populate('userId', 'username')
      .lean();
    
    res.json({ success: true, comment: populatedComment });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ success: false, error: err.message });
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

app.use((req, res) => {
  res.status(404).render('404', { title: 'Not found' });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal Server Error');
});

// ============================================
// START SERVER (ONLY AFTER DB CONNECTION)
// ============================================

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Connect to database first
    await connectDB();
    
    // Then start the server
    app.listen(PORT, '0.0.0.0', () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎵 MusicCloud v2.0 - Production Ready');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('📊 Features: Smart Recommendations, Genre/Mood Filtering');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
    
  } catch (err) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ FATAL ERROR: Failed to start server');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(err);
    process.exit(1);
  }
}

// Start the application
startServer();