/**
 * Script để seed dữ liệu quảng cáo mẫu vào database
 * Chạy: node scripts/seed-ads.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connectDB, AdvertisementCollection } = require('../backend/config/db');

async function seedAds() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Xóa dữ liệu cũ (nếu có)
    await AdvertisementCollection.deleteMany({});
    console.log('Cleared existing ads');

    // Dữ liệu quảng cáo mẫu
    const sampleAds = [
      {
        title: 'Quảng cáo SAOCLAO Pro',
        audioUrl: '/public/uploads/ads/ad_01.mp3',
        imageUrl: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1766492730/3e20ed10e7e358bd09d386d85b40cc19_bj1qh0.jpg',
        duration: 6,
        isActive: true,
        priority: 10,
        impressions: 0
      },
      {
        title: 'Quảng cáo Premium',
        audioUrl: '/public/uploads/ads/ad_02.mp3',
        imageUrl: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1766492747/ab64fe87312630c303e62efa4921c04c_g7lhvm.jpg',
        duration: 6,
        isActive: true,
        priority: 10,
        impressions: 0
      }
    ];

    // Insert vào database
    const result = await AdvertisementCollection.insertMany(sampleAds);
    console.log(`✓ Inserted ${result.length} advertisements`);

    console.log('\n=== Ads Created ===');
    result.forEach(ad => {
      console.log(`- ${ad.title} (${ad.duration}s, priority: ${ad.priority})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding ads:', error);
    process.exit(1);
  }
}

seedAds();
