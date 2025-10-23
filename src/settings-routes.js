const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { UserCollection } = require('./config');

const router = express.Router();

console.log('📝 Settings routes loaded!');
// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.flash = { type: 'warning', message: 'Vui lòng đăng nhập.' };
    return res.redirect('/login');
  }
  next();
};

// Avatar upload configuration
const AVATAR_DIR = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}_${req.session.user.id}${ext}`;
    cb(null, filename);
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
    
    // If avatar uploaded
    if (req.file) {
      updateData.avatarUrl = `/public/uploads/avatars/${req.file.filename}`;
      
      // Delete old avatar if exists
      const user = await UserCollection.findById(userId);
      if (user.avatarUrl && user.avatarUrl.startsWith('/public/uploads/avatars/')) {
        const oldPath = path.join(__dirname, '..', user.avatarUrl);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
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
  avatarUrl: updatedUser.avatarUrl || '',  // <-- THÊM DÒNG NÀY
  bio: updatedUser.bio || ''                // <-- VÀ DÒNG NÀY (optional)
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
