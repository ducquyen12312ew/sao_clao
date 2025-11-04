const mongoose = require('mongoose');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/MusicCloud';

async function connectDB() {
  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB: ${mongoose.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
}

// User Schema - them role
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  bio: { type: String, default: '', maxlength: 200 },
  avatarUrl: { type: String, default: '' },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Track Schema - them status cho duyet
const TrackSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  artist: { type: String, required: true, trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  audioUrl: { type: String, required: true },
  coverUrl: { type: String, default: '/images/default-cover.jpg' },
  genres: [{ type: String, trim: true }],
  tags: [{ type: String, trim: true }],
  mood: { type: String, trim: true },
  duration: { type: Number, default: 0 },
  playCount: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

TrackSchema.index({ title: 'text', artist: 'text', genres: 'text', tags: 'text' });

// Play History Schema
const PlayHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  trackId: { type: mongoose.Schema.Types.ObjectId, ref: 'Track', required: true, index: true },
  playedAt: { type: Date, default: Date.now, index: true }
});

PlayHistorySchema.index({ userId: 1, playedAt: -1 });

// Playlist Schema
const PlaylistSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tracks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Track' }],
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

PlaylistSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Comment Schema
const CommentSchema = new mongoose.Schema({
  trackId: { type: mongoose.Schema.Types.ObjectId, ref: 'Track', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 500 },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true }
});

// Follow Schema
const FollowSchema = new mongoose.Schema({
  follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  following: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true }
});

FollowSchema.index({ follower: 1, following: 1 }, { unique: true });

const UserCollection = mongoose.model('User', UserSchema);
const TrackCollection = mongoose.model('Track', TrackSchema);
const PlayHistoryCollection = mongoose.model('PlayHistory', PlayHistorySchema);
const PlaylistCollection = mongoose.model('Playlist', PlaylistSchema);
const CommentCollection = mongoose.model('Comment', CommentSchema);
const FollowCollection = mongoose.model('Follow', FollowSchema);

module.exports = {
  connectDB,
  UserCollection,
  TrackCollection,
  PlayHistoryCollection,
  PlaylistCollection,
  CommentCollection,
  FollowCollection,
  mongoose
};
