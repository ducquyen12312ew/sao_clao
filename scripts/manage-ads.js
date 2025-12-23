/**
 * Script helper để quản lý quảng cáo
 * 
 * Chạy các lệnh:
 * node scripts/manage-ads.js list          # Liệt kê tất cả ads
 * node scripts/manage-ads.js add           # Thêm ad mới (interactive)
 * node scripts/manage-ads.js toggle <id>   # Bật/tắt ad
 * node scripts/manage-ads.js delete <id>   # Xóa ad
 * node scripts/manage-ads.js stats         # Xem thống kê
 * node scripts/manage-ads.js test-pro <userId>  # Test set user thành Pro
 */

const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connectDB, AdvertisementCollection, UserCollection } = require('../backend/config/db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function listAds() {
  const ads = await AdvertisementCollection.find().sort({ priority: -1 });
  
  console.log('\n📋 Danh Sách Quảng Cáo:');
  console.log('─'.repeat(80));
  
  if (ads.length === 0) {
    console.log('Chưa có quảng cáo nào. Chạy: node scripts/seed-ads.js');
    return;
  }

  ads.forEach((ad, index) => {
    const status = ad.isActive ? '✅ Active' : '❌ Inactive';
    console.log(`${index + 1}. ${status} | ${ad.title}`);
    console.log(`   ID: ${ad._id}`);
    console.log(`   Audio: ${ad.audioUrl}`);
    console.log(`   Duration: ${ad.duration}s | Priority: ${ad.priority} | Impressions: ${ad.impressions}`);
    console.log('─'.repeat(80));
  });
}

async function addAd() {
  console.log('\n➕ Thêm Quảng Cáo Mới\n');
  
  const title = await question('Tiêu đề: ');
  const audioUrl = await question('Audio URL (vd: /public/uploads/ads/ad_04.mp3): ');
  const duration = parseInt(await question('Độ dài (giây): '), 10);
  const priority = parseInt(await question('Priority (1-10): '), 10);

  const newAd = await AdvertisementCollection.create({
    title,
    audioUrl,
    duration: duration || 30,
    priority: priority || 1,
    isActive: true,
    impressions: 0
  });

  console.log('\n✅ Đã thêm quảng cáo mới:');
  console.log(`ID: ${newAd._id}`);
  console.log(`Title: ${newAd.title}`);
}

async function toggleAd(adId) {
  const ad = await AdvertisementCollection.findById(adId);
  
  if (!ad) {
    console.log('❌ Không tìm thấy ad với ID:', adId);
    return;
  }

  ad.isActive = !ad.isActive;
  await ad.save();

  console.log(`✅ ${ad.title} → ${ad.isActive ? 'ACTIVE' : 'INACTIVE'}`);
}

async function deleteAd(adId) {
  const ad = await AdvertisementCollection.findByIdAndDelete(adId);
  
  if (!ad) {
    console.log('❌ Không tìm thấy ad với ID:', adId);
    return;
  }

  console.log(`✅ Đã xóa: ${ad.title}`);
}

async function showStats() {
  const ads = await AdvertisementCollection.find();
  const activeCount = ads.filter(ad => ad.isActive).length;
  const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);

  console.log('\n📊 Thống Kê Quảng Cáo:');
  console.log('─'.repeat(50));
  console.log(`Tổng số ads: ${ads.length}`);
  console.log(`Active: ${activeCount} | Inactive: ${ads.length - activeCount}`);
  console.log(`Tổng lượt phát: ${totalImpressions.toLocaleString()}`);
  console.log('─'.repeat(50));

  if (ads.length > 0) {
    console.log('\nTop 5 Ads Phổ Biến:');
    const topAds = ads.sort((a, b) => b.impressions - a.impressions).slice(0, 5);
    topAds.forEach((ad, i) => {
      console.log(`${i + 1}. ${ad.title}: ${ad.impressions.toLocaleString()} lượt`);
    });
  }
}

async function testSetPro(userId) {
  if (!userId) {
    console.log('❌ Thiếu userId. Usage: node scripts/manage-ads.js test-pro <userId>');
    return;
  }

  const user = await UserCollection.findById(userId);
  
  if (!user) {
    console.log('❌ Không tìm thấy user với ID:', userId);
    return;
  }

  user.isPro = !user.isPro;
  await user.save();

  console.log(`✅ User ${user.username} (@${user.name}):`);
  console.log(`   Pro Status: ${user.isPro ? '👑 PRO' : '🆓 FREE'}`);
}

async function main() {
  await connectDB();

  const command = process.argv[2];
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'list':
        await listAds();
        break;
      
      case 'add':
        await addAd();
        break;
      
      case 'toggle':
        if (!arg) {
          console.log('❌ Usage: node scripts/manage-ads.js toggle <adId>');
        } else {
          await toggleAd(arg);
        }
        break;
      
      case 'delete':
        if (!arg) {
          console.log('❌ Usage: node scripts/manage-ads.js delete <adId>');
        } else {
          await deleteAd(arg);
        }
        break;
      
      case 'stats':
        await showStats();
        break;
      
      case 'test-pro':
        await testSetPro(arg);
        break;
      
      default:
        console.log(`
🎯 Quản Lý Quảng Cáo - SAOCLAO

Usage:
  node scripts/manage-ads.js <command> [args]

Commands:
  list                    Liệt kê tất cả quảng cáo
  add                     Thêm quảng cáo mới (interactive)
  toggle <adId>           Bật/tắt quảng cáo
  delete <adId>           Xóa quảng cáo
  stats                   Xem thống kê
  test-pro <userId>       Toggle Pro status cho user (testing)

Examples:
  node scripts/manage-ads.js list
  node scripts/manage-ads.js toggle 507f1f77bcf86cd799439011
  node scripts/manage-ads.js test-pro 507f1f77bcf86cd799439012
        `);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
