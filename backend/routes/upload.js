const path = require('path');
const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const CloudinaryStorage = require('multer-storage-cloudinary');
const { TrackCollection } = require('../config/db');

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.session?.user) {
    req.session.flash = { type: 'warning', message: 'Vui lòng đăng nhập để upload.' };
    return req.session.save(() => res.redirect('/login'));
  }
  next();
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000 // 60s hard timeout để tránh treo
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isAudio = file.mimetype.startsWith('audio');
    const folder = isAudio ? 'musiccloud/audio' : 'musiccloud/covers';
    const resource_type = isAudio ? 'video' : 'image'; // Cloudinary coi audio là "video"

    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_');

    return {
      folder,
      resource_type,
      public_id: `${Date.now()}_${base}`, 

    };
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'audio') {
    return cb(null, /audio\/(mpeg|mp3|wav|aac|flac|m4a|mp4|ogg|opus|webm)/.test(file.mimetype));
  }
  if (file.fieldname === 'cover') {
    return cb(null, /image\/(png|jpe?g)/.test(file.mimetype));
  }
  cb(null, false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, 
});

router.get('/', requireAuth, (req, res) => {
  res.render('upload', { title: 'Upload music' });
});

const parseUpload = upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]);

router.post('/new', requireAuth, (req, res, next) => {
  parseUpload(req, res, (err) => {
    if (err) {
      console.error('Upload parse error:', err);
      req.session.flash = { type: 'danger', message: 'Không thể đọc file upload.' };
      return req.session.save(() => res.redirect('/upload'));
    }
    next();
  });
}, async (req, res) => {
    try {
      const { title, artist, genres, tags, mood, lyricsText, lyricsLRC } = req.body;
      const audio = req.files?.audio?.[0];
      const cover = req.files?.cover?.[0];
      console.log('[UPLOAD] incoming', {
        title,
        audio: audio ? { name: audio.originalname, size: audio.size, mimetype: audio.mimetype, path: audio.path } : null,
        cover: cover ? { name: cover.originalname, size: cover.size, mimetype: cover.mimetype, path: cover.path } : null
      });

      if (!title || !audio) {
        req.session.flash = { type: 'danger', message: 'Thiếu tiêu đề hoặc file audio.' };
        return res.redirect('/upload');
      }
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        req.session.flash = { type: 'danger', message: 'Chưa cấu hình Cloudinary trong .env' };
        return res.redirect('/upload');
      }

      const parsedGenres = (genres || '')
        .split(',')
        .map(g => g.trim())
        .filter(Boolean);

      const parsedTags = (tags || '')
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const audioUrl = audio.path; 
      const coverUrl =
        cover?.path ||
        process.env.CLOUDINARY_DEFAULT_COVER_URL ||
        '';

      await TrackCollection.create({
        title: title.trim(),
        artist: (artist || '').trim(),
        audioUrl,
        coverUrl,
        userId: req.session?.user?.id,
        status: 'approved', 
        createdAt: new Date(),
        updatedAt: new Date(),
        genres: parsedGenres,
        tags: parsedTags,
        mood: (mood || '').trim(),
        lyricsText: (lyricsText || '').trim(),
        lyricsLRC: (lyricsLRC || '').trim()
      });

      req.session.flash = { type: 'success', message: 'Upload thành công!' };
      res.redirect('/');
    } catch (err) {
      console.error('Upload error:', err);
      const message = err.message || 'Upload thất bại.';
      req.session.flash = { type: 'danger', message };
      res.redirect('/upload');
    }
});

module.exports = router;
