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

const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordHash: { 
    type: String, 
    required: true 
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  bio: {
    type: String,
    default: '',
    maxlength: 200
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  followersCount: {
    type: Number,
    default: 0
  },
  followingCount: {
    type: Number,
    default: 0
  },
  provider: {
    type: String,
    enum: ['local', 'google', 'facebook'],
    default: 'local'
  },
  providerId: {
    type: String,
    default: ''
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const TrackSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  artist: { 
    type: String, 
    required: true,
    trim: true
  },
  featuring: {
    type: String,
    default: '',
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  audioUrl: { 
    type: String, 
    required: true 
  },
  videoUrl: {
    type: String,
    default: ''
  },
  coverUrl: { 
    type: String,
    default: '/images/default-cover.jpg'
  },
  genres: [{ 
    type: String,
    trim: true
  }],
  tags: [{ 
    type: String,
    trim: true
  }],
  mood: { 
    type: String,
    trim: true
  },
  duration: {
    type: Number,
    default: 0
  },
  playCount: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  deletedAt: {
    type: Date,
    default: null
  },
  reportCount: {
    type: Number,
    default: 0
  },
  lyricsText: {
    type: String,
    default: '',
    trim: true
  },
  lyricsLRC: {
    type: String,
    default: '',
    trim: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

TrackSchema.index({ title: 'text', artist: 'text', genres: 'text', tags: 'text' });

const PlayHistorySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  trackId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Track', 
    required: true,
    index: true
  },
  playedAt: { 
    type: Date, 
    default: Date.now,
    index: true
  }
});

PlayHistorySchema.index({ userId: 1, playedAt: -1 });

const PlaylistSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  tracks: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Track' 
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

PlaylistSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const CommentSchema = new mongoose.Schema({
  trackId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Track', 
    required: true,
    index: true
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  text: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 500
  },
  likes: { 
    type: Number, 
    default: 0 
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  }
});

const FollowSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

FollowSchema.index({ follower: 1, following: 1 }, { unique: true });

const ReportSchema = new mongoose.Schema({
  trackId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Track', 
    required: true,
    index: true
  },
  reporterId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  reason: { 
    type: String, 
    enum: ['copyright', 'inappropriate', 'spam', 'misleading', 'other'],
    required: true 
  },
  description: { 
    type: String, 
    maxlength: 500,
    trim: true
  },
  status: { 
    type: String, 
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending',
    index: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  reviewedAt: { 
    type: Date 
  },
  reviewedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  adminNote: { 
    type: String, 
    maxlength: 500,
    trim: true
  }
});

ReportSchema.index({ trackId: 1, status: 1 });
ReportSchema.index({ reporterId: 1, trackId: 1 });

const PasswordResetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  used: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TrackLikeSchema = new mongoose.Schema({
  trackId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Track',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

TrackLikeSchema.index({ trackId: 1, userId: 1 }, { unique: true });

const UserCollection = mongoose.model('User', UserSchema);
const TrackCollection = mongoose.model('Track', TrackSchema);
const PlayHistoryCollection = mongoose.model('PlayHistory', PlayHistorySchema);
const PlaylistCollection = mongoose.model('Playlist', PlaylistSchema);
const CommentCollection = mongoose.model('Comment', CommentSchema);
const FollowCollection = mongoose.model('Follow', FollowSchema);
const ReportCollection = mongoose.model('Report', ReportSchema);
const PasswordResetCollection = mongoose.model('PasswordReset', PasswordResetSchema);
const TrackLikeCollection = mongoose.model('TrackLike', TrackLikeSchema);

module.exports = {
  connectDB,
  UserCollection,
  TrackCollection,
  PlayHistoryCollection,
  PlaylistCollection,
  CommentCollection,
  FollowCollection,
  ReportCollection,
  PasswordResetCollection,
  TrackLikeCollection,
  mongoose
};
