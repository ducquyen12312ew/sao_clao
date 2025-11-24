const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const CloudinaryStorage = require('multer-storage-cloudinary');
const { UserCollection } = require('../config/db');

const router = express.Router();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.flash = { type: 'warning', message: 'Vui lòng đăng nhập.' };
    return res.redirect('/login');
  }
  next();
};

// Cloudinary storage configuration for avatar uploads
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'musiccloud/avatars',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' }
    ]
  }
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
  if (/image\/(png|jpe?g|gif|webp)/.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed'), false);
  }
};

// Multer upload configuration
const upload = multer({ 
  storage, 
  fileFilter, 
  limits: { fileSize: 2 * 1024 * 1024 }
});

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
    
    if (req.file) {
      console.log('New avatar uploaded to Cloudinary:', req.file.path);
      
      const oldUser = await UserCollection.findById(userId).select('avatarUrl');
      
      updateData.avatarUrl = req.file.path;
      
      if (oldUser && oldUser.avatarUrl && oldUser.avatarUrl.includes('cloudinary.com')) {
        try {
          const matches = oldUser.avatarUrl.match(/\/musiccloud\/avatars\/([^/.]+)/);
          
          if (matches && matches[1]) {
            const publicId = `musiccloud/avatars/${matches[1]}`;
            console.log('Attempting to delete old avatar:', publicId);
            
            const result = await cloudinary.uploader.destroy(publicId);
            console.log('Cloudinary delete result:', result);
          }
        } catch (err) {
          console.error('Error deleting old avatar from Cloudinary:', err);
        }
      }
    }
    
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
