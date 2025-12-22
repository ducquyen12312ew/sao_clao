const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const crypto = require('crypto');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer = require('nodemailer');

dotenv.config();

const {
  connectDB,
  TrackCollection,
  UserCollection,
  PlayHistoryCollection,
  PlaylistCollection,
  CommentCollection,
  FollowCollection,
  ReportCollection,
  PasswordResetCollection,
  TrackLikeCollection
} = require('./config/db');

const uploadRoutes = require('./routes/upload');
const playlistRoutes = require('./routes/playlist');
const userRoutes = require('./routes/user');
const settingsRoutes = require('./routes/settings');
const adminRoutes = require('./routes/admin');

const app = express();
const SALT_ROUNDS = 10;
const PASSWORD_RULE_MESSAGE = 'Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters.';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'frontend', 'views'));
app.use('/public', express.static(path.join(__dirname, '..', 'frontend', 'public')));
app.use('/css', express.static(path.join(__dirname, '..', 'frontend', 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'frontend', 'public', 'js')));

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
    touchAfter: 24 * 3600
  })
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.oauthProviders = {
    google: !!(passport._strategies && passport._strategies.google)
  };
  next();
});

// Helpers
const isStrongPassword = (password) => {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
};

const buildSessionUser = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  avatarUrl: user.avatarUrl || '',
  bio: user.bio || '',
  role: user.role || 'user'
});

async function ensureUniqueUsername(base) {
  const safeBase = (base || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '') || `user${Date.now()}`;
  let candidate = safeBase;
  let counter = 1;
  while (await UserCollection.findOne({ username: candidate })) {
    candidate = `${safeBase}${counter}`;
    counter += 1;
  }
  return candidate;
}

async function upsertOAuthUser(provider, profile) {
  const email = profile.emails?.[0]?.value?.toLowerCase() || '';
  const providerId = profile.id;
  const displayName = profile.displayName || profile.name?.givenName || provider;
  const usernameBase = (profile.username || (email ? email.split('@')[0] : `user_${providerId.slice(0, 6)}`)).toLowerCase();

  let user = await UserCollection.findOne({ provider, providerId });
  if (!user && email) {
    user = await UserCollection.findOne({ email });
  }

  if (!user) {
    const username = await ensureUniqueUsername(usernameBase);
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);
    user = await UserCollection.create({
      name: displayName || username,
      username,
      email: email || `${username}@${provider}.local`,
      passwordHash,
      provider,
      providerId
    });
  } else if (!user.provider || user.provider === 'local') {
    user.provider = provider;
    user.providerId = providerId;
    await user.save();
  }

  return user;
}

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await UserCollection.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || `${APP_BASE_URL}/auth/google/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await upsertOAuthUser('google', profile);
        done(null, user);
      } catch (err) {
        console.error('Google strategy error:', err);
        done(err);
      }
    }
  ));
}

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        : undefined
    })
  : null;

const sendResetEmail = async (email, url) => {
  if (!transporter) {
    console.log('[RESET LINK]', url);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Reset SAOCLAO password',
    text: `You requested a password reset. Click the following link to continue: ${url}`,
    html: `<p>You requested a password reset.</p><p><a href="${url}">Click here to reset your password</a></p>`
  });
};

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.flash = { type: 'warning', message: 'Please sign in.' };
    return req.session.save(() => res.redirect('/login'));
  }
  next();
};

const getTrackFilter = (user) => {
  return user?.role === 'admin' ? {} : { status: 'approved' };
};

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/home');
  }
  return res.render('landing', { title: 'SAOCLAO' });
});

app.get('/artistpro', (req, res) => {
  const displayName = req.session.user?.name || req.session.user?.username || 'Tiep Kun';
  res.render('artistpro', { userName: displayName });
});

app.get('/home', requireAuth, async (req, res) => {
  try {
    const tracks = await TrackCollection
      .find({ status: 'approved', deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(18)
      .lean();

    return res.render('home', {
      title: 'SAOCLAO',
      tracks,
      user: req.session.user
    });
  } catch (err) {
    console.error('Home render error:', err);
    return res.status(500).send('Server error');
  }
});

app.get('/signup', (req, res) => {
  if (req.session.user) {
    req.session.flash = { type: 'info', message: 'You are already signed in.' };
    return req.session.save(() => res.redirect('/home'));
  }
  res.render('signup', { title: 'Create account' });
});

app.post('/signup', async (req, res) => {
  if (req.session.user) return res.redirect('/home');

  try {
    const { name, username, email, password } = req.body;
    
    if (!name || !username || !email || !password) {
      req.session.flash = { type: 'danger', message: 'Please fill in all required fields.' };
      return req.session.save(() => res.redirect('/signup'));
    }

    if (!isStrongPassword(password)) {
      req.session.flash = { type: 'danger', message: PASSWORD_RULE_MESSAGE };
      return req.session.save(() => res.redirect('/signup'));
    }
    
    const normalizedEmail = (email || '').toLowerCase().trim();
    const normalizedUsername = (username || '').toLowerCase().trim();

    const exists = await UserCollection.findOne({ 
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }] 
    });
    
    if (exists) {
      req.session.flash = { type: 'warning', message: 'Email or username already exists.' };
      return req.session.save(() => res.redirect('/signup'));
    }
    
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await UserCollection.create({ name, username: normalizedUsername, email: normalizedEmail, passwordHash });
    
    req.session.user = buildSessionUser(newUser);
    req.session.flash = { type: 'success', message: 'Welcome to SAOCLAO!' };
    req.session.save(() => res.redirect('/home'));
    
  } catch (err) {
    req.session.flash = { type: 'danger', message: 'Sign up failed. Please try again.' };
    req.session.save(() => res.redirect('/signup'));
  }
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/home');
  res.render('login', { title: 'Sign in' });
});

app.get('/feed', requireAuth, async (req, res) => {
  try {
    const tracks = await TrackCollection
      .find({ status: 'approved', deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    return res.render('feed', {
      title: 'Your Feed - SAOCLAO',
      tracks,
      user: req.session.user
    });
  } catch (err) {
    console.error('Feed render error:', err);
    return res.status(500).send('Server error');
  }
});

app.get('/library', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const filter = getTrackFilter(req.session.user);
    const baseFilter = { ...filter, deletedAt: null };

    const recentPlays = await PlayHistoryCollection
      .find({ userId })
      .sort({ playedAt: -1 })
      .limit(20)
      .populate({ path: 'trackId', match: baseFilter })
      .lean();

    const seenRecent = new Set();
    const recentlyPlayed = [];
    for (const doc of recentPlays) {
      if (doc.trackId && !seenRecent.has(doc.trackId._id.toString())) {
        seenRecent.add(doc.trackId._id.toString());
        recentlyPlayed.push(doc.trackId);
      }
    }

    const likedDocs = await TrackLikeCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate({ path: 'trackId', match: baseFilter })
      .lean();
    const likedTracks = likedDocs.map(d => d.trackId).filter(Boolean);

    const playlists = await PlaylistCollection
      .find({ userId })
      .populate({ path: 'tracks', match: baseFilter })
      .sort({ updatedAt: -1 })
      .limit(12)
      .lean();

    const followingDocs = await FollowCollection
      .find({ followerId: userId })
      .populate({ path: 'followingId', select: 'username name avatarUrl followersCount' })
      .lean();
    const followingUsers = followingDocs.map(d => d.followingId).filter(Boolean);

    res.render('library', {
      title: 'Library - SAOCLAO',
      user: req.session.user,
      recentlyPlayed,
      likedTracks,
      playlists,
      followingUsers,
      historyTracks: recentlyPlayed // reuse recent plays
    });
  } catch (err) {
    console.error('Library render error:', err);
    res.status(500).send('Server error');
  }
});

app.post('/login', async (req, res) => {
  if (req.session.user) return res.redirect('/home');
  
  try {
    const { identifier, password } = req.body;
    const normalizedId = (identifier || '').toLowerCase().trim();
    
    const user = await UserCollection.findOne({ 
      $or: [{ email: normalizedId }, { username: normalizedId }] 
    });
    
    if (!user) { 
      req.session.flash = { type: 'danger', message: 'Invalid credentials.' }; 
      return req.session.save(() => res.redirect('/login'));
    }
    
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) { 
      req.session.flash = { type: 'danger', message: 'Invalid credentials.' }; 
      return req.session.save(() => res.redirect('/login'));
    }
    
    req.logIn(user, (err) => {
      if (err) {
        req.session.flash = { type: 'danger', message: 'Unable to sign in.' };
        return req.session.save(() => res.redirect('/login'));
      }
      req.session.user = buildSessionUser(user);
      if (user.role === 'admin') {
        return req.session.save(() => res.redirect('/admin/dashboard'));
      }
      return req.session.save(() => res.redirect('/home'));
    });
    
  } catch (err) {
    req.session.flash = { type: 'danger', message: 'An error occurred. Please try again.' };
    req.session.save(() => res.redirect('/login'));
  }
});

// Social auth
if (passport._strategies && passport._strategies.google) {
  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  app.get('/auth/google/callback', (req, res, next) => {
    passport.authenticate('google', { failureRedirect: '/login' }, (err, user) => {
      if (err) {
        console.error('Google auth error:', err);
        req.session.flash = { type: 'danger', message: 'Google login failed.' };
        return req.session.save(() => res.redirect('/login'));
      }
      if (!user) {
        req.session.flash = { type: 'danger', message: 'Unable to authenticate with Google.' };
        return req.session.save(() => res.redirect('/login'));
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('Google login session error:', loginErr);
          req.session.flash = { type: 'danger', message: 'Unable to create login session.' };
          return req.session.save(() => res.redirect('/login'));
        }
        req.session.user = buildSessionUser(user);
        return req.session.save(() => res.redirect('/home'));
      });
    })(req, res, next);
  });
}

const doLogout = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
};

app.get('/logout', doLogout);
app.post('/logout', doLogout);

app.get('/forgot-password', (req, res) => {
  if (req.session.user) return res.redirect('/profile');
  res.render('forgot-password', { title: 'Forgot password' });
});

app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      req.session.flash = { type: 'danger', message: 'Please enter your email.' };
      return req.session.save(() => res.redirect('/forgot-password'));
    }

    const user = await UserCollection.findOne({ email: email.toLowerCase() });
    if (user) {
      await PasswordResetCollection.deleteMany({ userId: user._id });
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes
      await PasswordResetCollection.create({ userId: user._id, tokenHash, expiresAt });
      const resetUrl = `${APP_BASE_URL}/reset-password/${rawToken}`;
      await sendResetEmail(user.email, resetUrl);
    }

    req.session.flash = { type: 'success', message: 'If the email is valid, we have sent a reset link.' };
    req.session.save(() => res.redirect('/forgot-password'));
  } catch (err) {
    console.error('Forgot password error:', err);
    req.session.flash = { type: 'danger', message: 'An error occurred. Please try again.' };
    req.session.save(() => res.redirect('/forgot-password'));
  }
});

app.get('/reset-password/:token', async (req, res) => {
  const token = req.params.token;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const resetDoc = await PasswordResetCollection.findOne({
    tokenHash,
    used: false,
    expiresAt: { $gt: new Date() }
  });

  if (!resetDoc) {
    req.session.flash = { type: 'danger', message: 'Reset link is invalid or expired.' };
    return req.session.save(() => res.redirect('/forgot-password'));
  }

  res.render('reset-password', { title: 'Reset password', token });
});

app.post('/reset-password/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const { password } = req.body;

    if (!isStrongPassword(password)) {
      req.session.flash = { type: 'danger', message: PASSWORD_RULE_MESSAGE };
      return req.session.save(() => res.redirect(`/reset-password/${token}`));
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetDoc = await PasswordResetCollection.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!resetDoc) {
      req.session.flash = { type: 'danger', message: 'Reset link is invalid or expired.' };
      return req.session.save(() => res.redirect('/forgot-password'));
    }

    const user = await UserCollection.findById(resetDoc.userId);
    if (!user) {
      req.session.flash = { type: 'danger', message: 'User not found.' };
      return req.session.save(() => res.redirect('/forgot-password'));
    }

    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await user.save();

    resetDoc.used = true;
    await resetDoc.save();

    req.session.flash = { type: 'success', message: 'Password updated. Please sign in.' };
    req.session.save(() => res.redirect('/login'));
  } catch (err) {
    console.error('Reset password error:', err);
    req.session.flash = { type: 'danger', message: 'Could not reset password.' };
    req.session.save(() => res.redirect('/forgot-password'));
  }
});

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

app.get('/likes', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const filter = getTrackFilter(req.session.user);
    const baseFilter = { ...filter, deletedAt: null };

    const likes = await TrackLikeCollection.find({ userId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'trackId',
        match: baseFilter
      })
      .lean();

    const tracks = likes
      .map(l => l.trackId)
      .filter(Boolean);

    res.render('likes', {
      title: 'Liked tracks - SAOCLAO',
      user: req.session.user,
      tracks
    });
  } catch (err) {
    console.error('Likes page error:', err);
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

    const liked = await TrackLikeCollection.exists({
      trackId: req.params.id,
      userId: req.session.user.id
    });

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
      user: req.session.user,
      liked: !!liked
    });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

app.post('/api/tracks/:id/like', requireAuth, async (req, res) => {
  try {
    const trackId = req.params.id;
    const userId = req.session.user.id;
    const filter = getTrackFilter(req.session.user);

    const track = await TrackCollection.findOne({
      _id: trackId,
      deletedAt: null,
      ...filter
    });

    if (!track) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }

    const existing = await TrackLikeCollection.findOne({ trackId, userId });
    let liked;

    if (existing) {
      await TrackLikeCollection.deleteOne({ _id: existing._id });
      liked = false;
    } else {
      await TrackLikeCollection.create({ trackId, userId });
      liked = true;
    }

    const likes = await TrackLikeCollection.countDocuments({ trackId });
    await TrackCollection.findByIdAndUpdate(trackId, { likes });
    
    res.json({ success: true, likes, liked });
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
        message: 'Only admin can delete comment' 
      });
    }
    
    const commentId = req.params.id;
    
    const comment = await CommentCollection.findByIdAndDelete(commentId);
    
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Comment not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Comment deleted' 
    });
    
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred' 
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
        message: 'You have already reported this track' 
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
      message: 'Report sent. Admin will review soon.' 
    });
    
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ success: false, message: 'An error occurred' });
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
