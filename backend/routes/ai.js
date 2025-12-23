const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { v2: cloudinary } = require('cloudinary');
const { TrackCollection } = require('../config/db');

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const requireAuth = (req, res, next) => {
  if (!req.session?.user) {
    req.session.flash = { type: 'warning', message: 'Vui lòng đăng nhập.' };
    return req.session.save(() => res.redirect('/login'));
  }
  next();
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `ai_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
  }
});

const allowedExtensions = /\.(mid|midi|mp3|wav|m4a|flac|ogg)$/i;

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedExtensions.test(file.originalname.toLowerCase())) {
      return cb(null, true);
    }
    return cb(new Error('Định dạng file không được hỗ trợ'));
  }
});

const sourceTypeFromName = (name = '') => (/\.(mid|midi)$/i.test(name) ? 'midi' : 'audio');

router.get('/', requireAuth, (req, res) => {
  res.render('ai-generate', { title: 'AI Generate - SAOCLAO', user: req.session.user });
});

router.post('/generate', requireAuth, upload.single('file'), async (req, res) => {
  let tempPath = req.file?.path;
  try {
    if (!req.file) {
      req.session.flash = { type: 'danger', message: 'Vui lòng chọn file MIDI hoặc audio.' };
      return req.session.save(() => res.redirect('/ai'));
    }

    const secondsInput = Number(req.body.seconds);
    const temperatureInput = Number(req.body.temperature);
    const seconds = Math.max(5, Math.min(120, Number.isFinite(secondsInput) ? secondsInput : 30));
    let temperature = Number.isFinite(temperatureInput) ? temperatureInput : 1.0;
    temperature = Math.max(0.2, Math.min(2.0, temperature));

    const serviceUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000/generate';
    const formData = new FormData();
    formData.append('seconds', seconds.toString());
    formData.append('temperature', temperature.toString());
    formData.append('file', fs.createReadStream(tempPath), req.file.originalname);

    const aiResp = await axios.post(serviceUrl, formData, {
      headers: formData.getHeaders(),
      responseType: 'arraybuffer',
      timeout: 120000,
      validateStatus: () => true
    });

    if (aiResp.status >= 400) {
      const errorText = Buffer.isBuffer(aiResp.data)
        ? aiResp.data.toString('utf8')
        : (aiResp.data?.message || aiResp.statusText || 'AI service trả về lỗi');
      throw new Error(errorText);
    }

    const audioBuffer = Buffer.from(aiResp.data);

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'saoclai/generated',
          format: 'mp3'
        },
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
      stream.end(audioBuffer);
    });

    const coverUrl = process.env.CLOUDINARY_DEFAULT_COVER_URL || undefined;

    const track = await TrackCollection.create({
      title: `AI Generated - ${req.file.originalname}`,
      artist: req.session.user.name || req.session.user.username || 'AI',
      audioUrl: uploadResult.secure_url,
      coverUrl,
      userId: req.session.user.id,
      status: 'approved',
      aiGenerated: true,
      aiMeta: {
        seconds,
        temperature,
        sourceType: sourceTypeFromName(req.file.originalname),
        createdAt: new Date()
      },
      genres: [],
      tags: ['ai-generated'],
      mood: ''
    });

    req.session.flash = { type: 'success', message: 'Đã tạo track AI thành công!' };
    return req.session.save(() => res.redirect(`/track/${track._id}`));
  } catch (err) {
    console.error('AI generate error:', err);
    req.session.flash = { type: 'danger', message: `Tạo nhạc AI thất bại: ${err.message}` };
    return req.session.save(() => res.redirect('/ai'));
  } finally {
    if (tempPath) {
      fs.promises.unlink(tempPath).catch(() => {});
    }
  }
});

module.exports = router;
