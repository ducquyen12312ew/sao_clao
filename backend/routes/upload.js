const path = require('path');
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

const { TrackCollection } = require('../config/db');

const router = express.Router();

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session?.user) {
    req.session.flash = { type: 'warning', message: 'Vui lòng đăng nhập để upload.' };
    return req.session.save(() => res.redirect('/login'));
  }
  next();
};

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000 
});

// Multer memory storage
const storage = multer.memoryStorage();

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
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Helper: Upload buffer to Cloudinary via stream
const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    
    Readable.from(buffer).pipe(stream);
  });
};

// GET upload page
router.get('/', requireAuth, (req, res) => {
  const flash = req.session.flash;
  delete req.session.flash;
  res.render('upload', { 
    title: 'Upload music',
    user: req.session.user,
    flash: flash || null
  });
});

// POST upload
const parseUpload = upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]);

router.post('/new', requireAuth, (req, res, next) => {
  parseUpload(req, res, (err) => {
    if (err) {
      console.error('Upload parse error:', err);
      req.session.flash = { type: 'danger', message: 'Không thể đọc file upload.' };
      return req.session.save((saveErr) => {
        if (saveErr) console.error('Session save error:', saveErr);
        res.redirect('/upload');
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { title, artist, genres, tags, mood, lyricsText, lyricsLRC } = req.body;
    const audio = req.files?.audio?.[0];
    const cover = req.files?.cover?.[0];

    console.log('[UPLOAD] Starting upload process', {
      title,
      hasAudio: !!audio,
      hasCover: !!cover
    });

    // Validate
    if (!title || !audio) {
      req.session.flash = { type: 'danger', message: 'Thiếu tiêu đề hoặc file audio.' };
      return req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        res.redirect('/upload');
      });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      req.session.flash = { type: 'danger', message: 'Chưa cấu hình Cloudinary trong .env' };
      return req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        res.redirect('/upload');
      });
    }

    // Parse genres & tags
    const parsedGenres = (genres || '')
      .split(',')
      .map(g => g.trim())
      .filter(Boolean);

    const parsedTags = (tags || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    // Upload audio
    console.log('[UPLOAD] Uploading audio to Cloudinary...');
    const ext = path.extname(audio.originalname).toLowerCase();
    const base = path.basename(audio.originalname, ext).replace(/[^a-z0-9_-]/gi, '_');
    
    const audioResult = await uploadToCloudinary(audio.buffer, {
      folder: 'musiccloud/audio',
      resource_type: 'video',
      public_id: `${Date.now()}_${base}`,
      format: ext.replace('.', '') || 'mp3'
    });

    console.log('[UPLOAD] Audio uploaded successfully');

    // Upload cover (if exists)
    let coverUrl = process.env.CLOUDINARY_DEFAULT_COVER_URL || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800';
    
    if (cover) {
      console.log('[UPLOAD] Uploading cover to Cloudinary...');
      const coverExt = path.extname(cover.originalname).toLowerCase();
      const coverBase = path.basename(cover.originalname, coverExt).replace(/[^a-z0-9_-]/gi, '_');
      
      const coverResult = await uploadToCloudinary(cover.buffer, {
        folder: 'musiccloud/covers',
        resource_type: 'image',
        public_id: `${Date.now()}_${coverBase}`,
        transformation: [
          { width: 800, height: 800, crop: 'fill' }
        ]
      });

      coverUrl = coverResult.secure_url;
      console.log('[UPLOAD] Cover uploaded successfully');
    }

    // Save to DB
    console.log('[UPLOAD] Saving to database...');
    await TrackCollection.create({
      title: title.trim(),
      artist: (artist || '').trim(),
      audioUrl: audioResult.secure_url,
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

    console.log('[UPLOAD] Track saved successfully');

    // Set success flash and redirect
    req.session.flash = { 
      type: 'success', 
      message: `Tải lên "${title.trim()}" thành công!` 
    };
    
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/home');
      }
      console.log('[UPLOAD] Redirecting to /home');
      return res.redirect('/home');
    });
    
  } catch (err) {
    console.error('[UPLOAD] Error:', err);
    const message = err.message || 'Upload thất bại. Vui lòng thử lại.';
    req.session.flash = { type: 'danger', message };
    
    req.session.save((saveErr) => {
      if (saveErr) console.error('Session save error:', saveErr);
      res.redirect('/upload');
    });
  }
});

module.exports = router;