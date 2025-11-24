const express = require('express');
const { 
  UserCollection, 
  FollowCollection, 
  TrackCollection,
  PlaylistCollection 
} = require('../config/db');

const router = express.Router();

// ============================================
// MIDDLEWARE
// ============================================

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.flash = { type: 'warning', message: 'Vui lòng đăng nhập.' };
    return res.redirect('/login');
  }
  next();
};

// ============================================
// PUBLIC PROFILE PAGE
// ============================================

router.get('/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const currentUserId = req.session.user?.id;
    
    // Find user by username
    const user = await UserCollection
      .findOne({ username })
      .select('-passwordHash -email')
      .lean();
    
    if (!user) {
      req.session.flash = { type: 'danger', message: 'Không tìm thấy người dùng này.' };
      return res.redirect('/');
    }
    
    // Check if current user is viewing their own profile
    const isOwnProfile = currentUserId && user._id.toString() === currentUserId.toString();
    
    // Check if current user is following this profile
    let isFollowing = false;
    if (currentUserId && !isOwnProfile) {
      const followDoc = await FollowCollection.findOne({
        follower: currentUserId,
        following: user._id
      });
      isFollowing = !!followDoc;
    }
    
    // Get user's tracks
    const tracks = await TrackCollection
      .find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();
    
    // Get user's public playlists
    const playlists = await PlaylistCollection
      .find({ 
        userId: user._id,
        isPublic: true 
      })
      .populate('tracks')
      .sort({ updatedAt: -1 })
      .limit(6)
      .lean();
    
    // Calculate total plays
    const totalPlays = tracks.reduce((sum, track) => sum + (track.playCount || 0), 0);
    
    // Calculate total likes
    const totalLikes = tracks.reduce((sum, track) => sum + (track.likes || 0), 0);
    
    res.render('user-profile', {
      title: `${user.name} (@${user.username}) - SAOCLAO`,
      profileUser: user,
      user: req.session.user || null,
      isOwnProfile,
      isFollowing,
      tracks,
      playlists,
      totalPlays,
      totalLikes
    });
    
  } catch (err) {
    console.error('User profile error:', err);
    res.status(500).send('Server error');
  }
});

// ============================================
// FOLLOW USER
// ============================================

router.post('/:username/follow', requireAuth, async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const followerId = req.session.user.id;
    
    // Find user to follow
    const userToFollow = await UserCollection.findOne({ username });
    
    if (!userToFollow) {
      return res.json({ success: false, message: 'Người dùng không tồn tại' });
    }
    
    const followingId = userToFollow._id;
    
    // Can't follow yourself
    if (followerId.toString() === followingId.toString()) {
      return res.json({ success: false, message: 'Bạn không thể follow chính mình' });
    }
    
    // Check if already following
    const existingFollow = await FollowCollection.findOne({
      follower: followerId,
      following: followingId
    });
    
    if (existingFollow) {
      return res.json({ success: false, message: 'Bạn đã follow người này rồi' });
    }
    
    // Create follow relationship
    await FollowCollection.create({
      follower: followerId,
      following: followingId
    });
    
    // Update follower/following counts
    await UserCollection.findByIdAndUpdate(followerId, {
      $inc: { followingCount: 1 }
    });
    
    await UserCollection.findByIdAndUpdate(followingId, {
      $inc: { followersCount: 1 }
    });
    
    res.json({ 
      success: true, 
      message: 'Đã follow',
      followersCount: userToFollow.followersCount + 1
    });
    
  } catch (err) {
    console.error('Follow error:', err);
    res.status(500).json({ success: false, message: 'Có lỗi xảy ra' });
  }
});

// ============================================
// UNFOLLOW USER
// ============================================

router.post('/:username/unfollow', requireAuth, async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const followerId = req.session.user.id;
    
    // Find user to unfollow
    const userToUnfollow = await UserCollection.findOne({ username });
    
    if (!userToUnfollow) {
      return res.json({ success: false, message: 'Người dùng không tồn tại' });
    }
    
    const followingId = userToUnfollow._id;
    
    // Find and delete follow relationship
    const followDoc = await FollowCollection.findOneAndDelete({
      follower: followerId,
      following: followingId
    });
    
    if (!followDoc) {
      return res.json({ success: false, message: 'Bạn chưa follow người này' });
    }
    
    // Update follower/following counts
    await UserCollection.findByIdAndUpdate(followerId, {
      $inc: { followingCount: -1 }
    });
    
    await UserCollection.findByIdAndUpdate(followingId, {
      $inc: { followersCount: -1 }
    });
    
    res.json({ 
      success: true, 
      message: 'Đã unfollow',
      followersCount: Math.max(0, userToUnfollow.followersCount - 1)
    });
    
  } catch (err) {
    console.error('Unfollow error:', err);
    res.status(500).json({ success: false, message: 'Có lỗi xảy ra' });
  }
});

// ============================================
// GET FOLLOWERS LIST
// ============================================

router.get('/:username/followers', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    
    const user = await UserCollection.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const followers = await FollowCollection
      .find({ following: user._id })
      .populate('follower', 'username name avatarUrl')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    res.json({ 
      success: true, 
      followers: followers.map(f => f.follower) 
    });
    
  } catch (err) {
    console.error('Get followers error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// GET FOLLOWING LIST
// ============================================

router.get('/:username/following', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    
    const user = await UserCollection.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const following = await FollowCollection
      .find({ follower: user._id })
      .populate('following', 'username name avatarUrl')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    res.json({ 
      success: true, 
      following: following.map(f => f.following) 
    });
    
  } catch (err) {
    console.error('Get following error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
