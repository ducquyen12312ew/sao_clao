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
  PlayHistoryCollection
} = require('./config');

const uploadRoutes = require('./upload-routes');

const app = express();
const SALT_ROUNDS = 10;

connectDB();

// Views & static
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// Parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Silence favicon
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Sessions
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

// Locals
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Helpers
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.flash = { type: 'warning', message: 'Vui lòng đăng nhập.' };
    return res.redirect('/login');
  }
  next();
};

// HOME
app.get('/', async (req, res) => {
  if (req.session.user) return res.redirect('/profile'); 
  const tracks = await TrackCollection.find().sort({ createdAt: -1 }).limit(12).lean();
  res.render('home', { title: 'MusicCloud - Discover. Get Discovered.', tracks });
});


/* ------------------------- AUTH (đã merge) ------------------------- */
// SIGNUP
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
      req.session.flash = { type: 'danger', message: 'Vui lòng điền đầy đủ.' };
      return res.redirect('/signup');
    }
    const exists = await UserCollection.findOne({ $or: [{ email }, { username }] });
    if (exists) {
      req.session.flash = { type: 'warning', message: 'Email hoặc username đã tồn tại.' };
      return res.redirect('/signup');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const u = await UserCollection.create({ name, username, email, passwordHash });
    req.session.user = { id: u._id, name: u.name, username: u.username };
    req.session.flash = { type: 'success', message: 'Tạo tài khoản thành công!' };
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'danger', message: 'Đăng ký thất bại.' };
    res.redirect('/signup');
  }
});

// LOGIN
app.get('/login', (req,res)=>{
  if (req.session.user) return res.redirect('/profile');
  res.render('login', { title: 'Sign in' });
});

// POST form
app.post('/login', async (req,res)=>{
  if (req.session.user) return res.redirect('/profile');
  const { identifier, password } = req.body;
  const user = await UserCollection.findOne({ $or: [{ email: identifier }, { username: identifier }] });
  if (!user) { req.session.flash = { type:'danger', message:'Sai thông tin đăng nhập.' }; return res.redirect('/login'); }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) { req.session.flash = { type:'danger', message:'Sai thông tin đăng nhập.' }; return res.redirect('/login'); }
  req.session.user = { id: user._id, name: user.name, username: user.username };
  res.redirect('/profile');                      
});

const doLogout = (req, res) => req.session.destroy(() => res.redirect('/')); 
app.get('/logout', doLogout);
app.post('/logout', doLogout);


/* ------------------------- PROFILE ------------------------- */
// Ghi lịch sử khi play (client gọi POST khi user bấm play)
app.post('/api/plays/:trackId', requireAuth, async (req, res) => {
  try {
    const trackId = req.params.trackId;
    const userId = req.session.user.id;
    await PlayHistoryCollection.create({ userId, trackId, playedAt: new Date() });
    await TrackCollection.updateOne({ _id: trackId }, { $inc: { plays: 1 } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

// Trang cá nhân
app.get(['/me', '/profile'], requireAuth, async (req, res) => {
  const userId = req.session.user.id;

  // Recently Played (join track)
  const recentDocs = await PlayHistoryCollection
    .find({ userId })
    .sort({ playedAt: -1 })
    .limit(12)
    .populate('trackId')
    .lean();

  const recentlyPlayed = recentDocs
    .map(d => d.trackId)
    .filter(Boolean);

  // More of what you like: tạm thời lấy theo nhiều plays nhất
  const moreOfWhatYouLike = await TrackCollection.find()
    .sort({ plays: -1, createdAt: -1 })
    .limit(8)
    .lean();

  // Recommend: mới nhất
  const recommendations = await TrackCollection.find()
    .sort({ createdAt: -1 })
    .limit(12)
    .lean();

  res.render('profile', {
    title: `@${req.session.user.username} • SAOCLAO`,
    user: req.session.user,
    moreOfWhatYouLike,
    recentlyPlayed,
    recommendations
  });
});

app.use('/upload', uploadRoutes);

// 404
app.use((req, res) => res.status(404).render('404', { title: 'Not found' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MusicCloud v2 on http://localhost:${PORT}`));
