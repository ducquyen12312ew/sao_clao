const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { UserCollection } = require('./config');

const router = express.Router();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.flash = { type: 'warning', message: 'Vui lòng đăng nhập.' };
    return res.redirect('/login');
  }
  next();
};

// Avatar upload configuration với Cloudinary
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
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

// ============================================
// SETTINGS PAGE
// ============================================

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Get full user data
    const user = await UserCollection.findById(userId)
      .select('-passwordHash')
      .lean();
    
    if (!user) {
      return res.redirect('/login');
    }
    
    res.render('settings', {
      title: 'Settings - SAOCLAO',
      user: {
        ...req.session.user,
        bio: user.bio,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (err) {
    console.error('Settings page error:', err);
    res.status(500).send('Server error');
  }
});

// ============================================
// UPDATE PROFILE
// ============================================

router.post('/profile', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { name, bio } = req.body;
    
    const updateData = {
      name: name.trim(),
      bio: bio ? bio.trim() : ''
    };
    
    // If avatar uploaded to Cloudinary
    if (req.file) {
      updateData.avatarUrl = req.file.path; // Cloudinary URL
      
      // Delete old avatar from Cloudinary if exists
      const user = await UserCollection.findById(userId);
      if (user.avatarUrl && user.avatarUrl.includes('cloudinary.com')) {
        try {
          // Extract public_id from URL
          const urlParts = user.avatarUrl.split('/');
          const fileWithExt = urlParts[urlParts.length - 1];
          const publicId = `musiccloud/avatars/${fileWithExt.split('.')[0]}`;
          
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.error('Error deleting old avatar from Cloudinary:', err);
        }
      }
    }
    
    // Update user
    const updatedUser = await UserCollection.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    );
    
    // Update session
    req.session.user = {
      id: updatedUser._id,
      name: updatedUser.name,
      username: updatedUser.username,
      avatarUrl: updatedUser.avatarUrl || '',
      bio: updatedUser.bio || ''
    };

    req.session.flash = {
      type: 'success',
      message: 'Profile updated successfully!'
    };
    
    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
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