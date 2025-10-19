const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://0.0.0.0:27017/MusicCloud';
  try {
    await mongoose.connect(uri, { autoIndex: true });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

const UserCollection = mongoose.models.users || mongoose.model('users', UserSchema);

const TrackSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  artist: { type: String, default: 'Unknown', trim: true },
  audioUrl: { type: String, required: true },
  coverUrl: { type: String, default: '' },
  plays: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

const PlayHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  trackId: { type: mongoose.Schema.Types.ObjectId, ref: 'tracks', required: true },
  playedAt: { type: Date, default: Date.now }
}, { versionKey: false });

const LikeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  trackId: { type: mongoose.Schema.Types.ObjectId, ref: 'tracks', required: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

const PlaylistSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  tracks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'tracks' }],
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

const TrackCollection = mongoose.models.tracks || mongoose.model('tracks', TrackSchema);
const PlayHistoryCollection = mongoose.models.play_histories || mongoose.model('play_histories', PlayHistorySchema);
const LikeCollection = mongoose.models.likes || mongoose.model('likes', LikeSchema);
const PlaylistCollection = mongoose.models.playlists || mongoose.model('playlists', PlaylistSchema);

module.exports = {
  mongoose,
  connectDB,
  UserCollection,
  TrackCollection,
  PlayHistoryCollection,
  LikeCollection,
  PlaylistCollection
};