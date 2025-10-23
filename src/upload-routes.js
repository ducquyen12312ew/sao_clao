const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { TrackCollection } = require('./config');

const router = express.Router();
const AUDIO_DIR = path.join(__dirname, '..', 'public', 'uploads', 'audio');
const COVER_DIR = path.join(__dirname, '..', 'public', 'uploads', 'covers');
fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(COVER_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => { if (file.fieldname === 'audio') return cb(null, AUDIO_DIR); cb(null, COVER_DIR); },
  filename: (req, file, cb) => { const ext = path.extname(file.originalname).toLowerCase(); const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi,'_'); cb(null, `${Date.now()}_${base}${ext}`); }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'audio') return cb(null, /audio\/(mpeg|mp3|wav)/.test(file.mimetype));
  if (file.fieldname === 'cover') return cb(null, /image\/(png|jpe?g)/.test(file.mimetype));
  cb(null, false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/', (req,res)=> res.render('upload', { title: 'Upload music' }));

router.post('/new', upload.fields([{name:'audio',maxCount:1},{name:'cover',maxCount:1}]), async (req,res)=>{
  try{
    const { title, artist } = req.body;
    const audio = req.files?.audio?.[0];
    const cover = req.files?.cover?.[0];
    if(!title || !audio){ req.session.flash = { type: 'danger', message: 'Thiếu tiêu đề hoặc file audio.' }; return res.redirect('/upload'); }
    const audioUrl = `/public/uploads/audio/${audio.filename}`;
    const coverUrl = cover ? `/public/uploads/covers/${cover.filename}` : '';
    
    await TrackCollection.create({ 
  title: title.trim(), 
  artist: (artist||'').trim(), 
  audioUrl, 
  coverUrl,
  userId: req.session.user.id 
});
    req.session.flash = { type: 'success', message: 'Upload thành công!' };
    res.redirect('/');
  }catch(err){ console.error(err); req.session.flash = { type: 'danger', message: 'Upload thất bại.' }; res.redirect('/upload'); }
});

module.exports = router;
