const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB URI with fallback
const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/MusicCloud';

// Connect to MongoDB with proper error handling
async function connectDB() {
  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log(`📁 Database: ${mongoose.connection.db.databaseName}`);
    console.log(`🔗 Host: ${mongoose.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Full error:', error);
    throw error; // Throw để index.js xử lý
  }
}

// ==================== SCHEMAS ====================

// User Schema
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
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Track Schema with Genres, Tags, Mood
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
  audioUrl: { 
    type: String, 
    required: true 
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
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Add text index for search functionality
TrackSchema.index({ title: 'text', artist: 'text', genres: 'text', tags: 'text' });

// Play History Schema
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

// Compound index for efficient queries
PlayHistorySchema.index({ userId: 1, playedAt: -1 });

// Playlist Schema
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

// Update timestamp on save
PlaylistSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Comment Schema
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

// ==================== MODELS ====================

const UserCollection = mongoose.model('User', UserSchema);
const TrackCollection = mongoose.model('Track', TrackSchema);
const PlayHistoryCollection = mongoose.model('PlayHistory', PlayHistorySchema);
const PlaylistCollection = mongoose.model('Playlist', PlaylistSchema);
const CommentCollection = mongoose.model('Comment', CommentSchema);

// ==================== EXPORTS ====================

module.exports = {
  connectDB,
  UserCollection,
  TrackCollection,
  PlayHistoryCollection,
  PlaylistCollection,
  CommentCollection,
  mongoose
};