const express = require('express');
const { AdvertisementCollection } = require('../config/db');

const router = express.Router();

/**
 * GET /api/ads/get
 * Lấy 1 quảng cáo ngẫu nhiên để phát
 * Chỉ user KHÔNG phải Pro mới nhận quảng cáo
 */
router.get('/get', async (req, res) => {
  try {
    // Kiểm tra user có phải Pro không
    if (req.session.user?.isPro) {
      return res.json({
        success: true,
        ad: null,
        message: 'Pro user - no ads'
      });
    }

    // Lấy tất cả ads đang active
    const ads = await AdvertisementCollection.find({ isActive: true }).lean();

    if (!ads || ads.length === 0) {
      return res.json({
        success: false,
        ad: null,
        message: 'No ads available'
      });
    }

    // Chọn quảng cáo dựa trên priority (weight-based random)
    // Ads có priority cao hơn sẽ có xác suất được chọn cao hơn
    const totalPriority = ads.reduce((sum, ad) => sum + ad.priority, 0);
    let random = Math.random() * totalPriority;

    let selectedAd = ads[0];
    for (const ad of ads) {
      random -= ad.priority;
      if (random <= 0) {
        selectedAd = ad;
        break;
      }
    }

    // Tăng impression count
    await AdvertisementCollection.findByIdAndUpdate(
      selectedAd._id,
      { $inc: { impressions: 1 } }
    );

    res.json({
      success: true,
      ad: {
        id: selectedAd._id,
        title: selectedAd.title,
        audioUrl: selectedAd.audioUrl,
        imageUrl: selectedAd.imageUrl,
        duration: selectedAd.duration
      }
    });

  } catch (error) {
    console.error('Error fetching ad:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      ad: null
    });
  }
});

/**
 * GET /api/ads/check-pro
 * Kiểm tra user có phải Pro không
 */
router.get('/check-pro', (req, res) => {
  const isPro = req.session.user?.isPro || false;
  res.json({ isPro });
});

/**
 * POST /api/ads/impression/:adId
 * Track ad impression (optional - để tracking chi tiết hơn)
 */
router.post('/impression/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    
    await AdvertisementCollection.findByIdAndUpdate(
      adId,
      { $inc: { impressions: 1 } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking impression:', error);
    res.json({ success: false });
  }
});

module.exports = router;
