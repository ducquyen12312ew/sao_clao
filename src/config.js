// src/config.js - REPLACE COMPLETELY

const mongoose = require('mongoose');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI || 'mongodb://0.0.0.0:27017/MusicCloud';

async function connectDB() {
  try {
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// User Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Track Schema with Genres, Tags, Mood
const TrackSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  audioUrl: { type: String, required: true },
  coverUrl: { type: String },
  genres: [{ type: String }],  // NEW: Array of genres
  tags: [{ type: String }],    // NEW: Array of tags
  mood: { type: String },      // NEW: Mood/vibe of the song
  createdAt: { type: Date, default: Date.now }
});

// Add text index for search
TrackSchema.index({ title: 'text', artist: 'text' });

// Play History Schema
const PlayHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  trackId: { type: mongoose.Schema.Types.ObjectId, ref: 'Track', required: true },
  playedAt: { type: Date, default: Date.now }
});

// Playlist Schema
const PlaylistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tracks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Track' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const CommentSchema = new mongoose.Schema({
  trackId: { type: mongoose.Schema.Types.ObjectId, ref: 'Track', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const UserCollection = mongoose.model('User', UserSchema);
const TrackCollection = mongoose.model('Track', TrackSchema);
const PlayHistoryCollection = mongoose.model('PlayHistory', PlayHistorySchema);
const PlaylistCollection = mongoose.model('Playlist', PlaylistSchema);
const CommentCollection = mongoose.model('Comment', CommentSchema);

module.exports = {
  connectDB,
  UserCollection,
  TrackCollection,
  PlayHistoryCollection,
  PlaylistCollection,
  CommentCollection
};