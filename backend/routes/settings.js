const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const { UserCollection } = require('../config/db');

const router = express.Router();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.flash = { type: 'warning', message: 'Vui lòng đăng nhập.' };
    return res.redirect('/login');
  }
  next();
};

// Multer memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (/image\/(png|jpe?g|gif|webp)/.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter, 
  limits: { fileSize: 2 * 1024 * 1024 }
});

// Helper: Upload buffer lên Cloudinary qua stream
const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    
    Readable.from(buffer).pipe(stream);
  });
};

// GET settings page
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const user = await UserCollection.findById(userId)
      .select('-passwordHash')
      .lean();
    
    if (!user) {
      req.session.flash = { type: 'danger', message: 'User not found' };
      return res.redirect('/login');
    }
    
    res.render('settings', {
      title: 'Settings - SAOCLAO',
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        bio: user.bio || '',
        avatarUrl: user.avatarUrl || ''
      }
    });
  } catch (err) {
    console.error('Settings page error:', err);
    res.status(500).send('Server error');
  }
});

// POST update profile
router.post('/profile', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { name, bio } = req.body;
    
    if (!name || name.trim().length === 0) {
      req.session.flash = {
        type: 'danger',
        message: 'Name cannot be empty'
      };
      return req.session.save(() => res.redirect('/settings'));
    }
    
    const updateData = {
      name: name.trim(),
      bio: bio ? bio.trim() : ''
    };
    
    // Upload avatar nếu có
    if (req.file) {
      console.log('[SETTINGS] Uploading new avatar to Cloudinary...');
      
      // Get old user to delete old avatar
      const oldUser = await UserCollection.findById(userId).select('avatarUrl');
      
      // Upload new avatar
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: 'musiccloud/avatars',
        resource_type: 'image',
        public_id: `avatar_${userId}_${Date.now()}`,
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' }
        ]
      });
      
      updateData.avatarUrl = result.secure_url;
      console.log('[SETTINGS] New avatar uploaded:', result.secure_url);
      
      // Delete old avatar from Cloudinary
      if (oldUser && oldUser.avatarUrl && oldUser.avatarUrl.includes('cloudinary.com')) {
        try {
          const matches = oldUser.avatarUrl.match(/\/musiccloud\/avatars\/([^/.]+)/);
          
          if (matches && matches[1]) {
            const publicId = `musiccloud/avatars/${matches[1]}`;
            console.log('[SETTINGS] Deleting old avatar:', publicId);
            
            const deleteResult = await cloudinary.uploader.destroy(publicId);
            console.log('[SETTINGS] Delete result:', deleteResult);
          }
        } catch (err) {
          console.error('[SETTINGS] Error deleting old avatar:', err);
        }
      }
    }
    
    // Update user in DB
    const updatedUser = await UserCollection.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select('-passwordHash');
    
    if (!updatedUser) {
      req.session.flash = {
        type: 'danger',
        message: 'Failed to update profile'
      };
      return req.session.save(() => res.redirect('/settings'));
    }
    
    // Update session
    req.session.user = {
      id: updatedUser._id.toString(),
      name: updatedUser.name,
      username: updatedUser.username,
      avatarUrl: updatedUser.avatarUrl || '',
      bio: updatedUser.bio || '',
      role: updatedUser.role || 'user'
    };

    req.session.flash = {
      type: 'success',
      message: 'Profile updated successfully!'
    };
    
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      }
      res.redirect('/settings');
    });
    
  } catch (err) {
    console.error('Update profile error:', err);
    req.session.flash = {
      type: 'danger',
      message: 'Failed to update profile. Please try again.'
    };
    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.redirect('/settings');
    });
  }
});

module.exports = router;