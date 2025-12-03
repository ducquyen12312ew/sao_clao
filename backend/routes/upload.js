const path = require('path');
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary');
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

const isCloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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
    return cb(null, /audio\/(mpeg|mp3|wav)/.test(file.mimetype));
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

const ensureCloudinaryConfigured = (req, res, next) => {
  if (!isCloudinaryConfigured) {
    req.session.flash = { type: 'danger', message: 'Cloudinary chưa được cấu hình. Thêm CLOUDINARY_* vào env để upload.' };
    return req.session.save(() => res.redirect('/upload'));
  }
  next();
};

const getCloudinaryUrl = (file) => file?.secure_url || file?.path || file?.url || '';

router.get('/', requireAuth, (req, res) => {
  res.render('upload', { title: 'Upload music' });
});

router.post(
  '/new',
  requireAuth,
  ensureCloudinaryConfigured,
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, artist, genres, tags, mood, lyricsText, lyricsLRC } = req.body;
      const audio = req.files?.audio?.[0];
      const cover = req.files?.cover?.[0];

      if (!title || !audio) {
        req.session.flash = { type: 'danger', message: 'Thiếu tiêu đề hoặc file audio.' };
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

      const audioUrl = getCloudinaryUrl(audio);
      const coverUrl = getCloudinaryUrl(cover) ||
        process.env.CLOUDINARY_DEFAULT_COVER_URL ||
        '';

      if (!audioUrl) {
        req.session.flash = { type: 'danger', message: 'Không lấy được URL audio từ Cloudinary.' };
        return req.session.save(() => res.redirect('/upload'));
      }

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
      req.session.flash = { type: 'danger', message: 'Upload thất bại.' };
      res.redirect('/upload');
    }
  }
);

module.exports = router;
