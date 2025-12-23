# 🎉 Quick Start: Advertisement System

## 📦 Các File Đã Được Tạo/Chỉnh Sửa

### Backend
- ✅ `backend/config/db.js` - Thêm isPro vào User, tạo Advertisement model
- ✅ `backend/routes/ads.js` - API endpoints cho quảng cáo
- ✅ `backend/server.js` - Mount ads routes, thêm isPro vào session

### Frontend
- ✅ `frontend/public/js/player.js` - Logic tracking, trigger, và phát quảng cáo
- ✅ `frontend/public/css/ads.css` - Styles cho ad overlay
- ✅ `frontend/views/home.ejs` - Thêm ads.css
- ✅ `frontend/views/likes.ejs` - Thêm ads.css
- ✅ `frontend/views/playlist-detail.ejs` - Thêm ads.css
- ✅ `frontend/views/track-detail.ejs` - Thêm ads.css

### Scripts & Ads
- ✅ `scripts/seed-ads.js` - Seed quảng cáo vào DB
- ✅ `scripts/manage-ads.js` - Quản lý quảng cáo (CLI tool)
- ✅ `frontend/public/uploads/ads/` - Folder chứa file MP3

### Documentation
- ✅ `ADVERTISEMENT_SYSTEM.md` - Tài liệu chi tiết hệ thống
- ✅ `frontend/public/uploads/ads/SETUP_GUIDE.md` - Hướng dẫn tạo file quảng cáo

---

## 🚀 Bắt Đầu Ngay

### Bước 1: Tạo File Quảng Cáo MP3

**Option A: Tạo file test với ffmpeg**
```powershell
cd frontend\public\uploads\ads
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 15 -acodec libmp3lame ad_01.mp3
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 20 -acodec libmp3lame ad_02.mp3
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 15 -acodec libmp3lame ad_03.mp3
```

**Option B: Sử dụng TTS online**
1. Truy cập https://ttsmp3.com/
2. Nhập: "Nâng cấp lên SAOCLAO Pro để nghe nhạc không quảng cáo"
3. Download MP3 → đặt vào `frontend/public/uploads/ads/ad_01.mp3`

### Bước 2: Seed Quảng Cáo Vào Database
```bash
node scripts/seed-ads.js
```

Expected output:
```
✓ Inserted 3 advertisements
=== Ads Created ===
- Nâng cấp Pro - Nghe nhạc không quảng cáo (15s, priority: 10)
- SAOCLAO Pro - Trải nghiệm cao cấp (20s, priority: 8)
- Khám phá tính năng mới (15s, priority: 5)
```

### Bước 3: Test Hệ Thống

#### Test với Free User (sẽ bị quảng cáo)
```bash
# Start server
npm start

# Đăng nhập với user bình thường
# Nghe 2 bài nhạc liên tiếp
# → Quảng cáo sẽ xuất hiện sau bài thứ 2
```

#### Test với Pro User (không bị quảng cáo)
```bash
# Lấy userId của user cần test
node scripts/manage-ads.js test-pro <userId>

# Reload trang web và đăng nhập lại
# → Không bị quảng cáo
```

---

## 🎯 Cấu Hình

### Điều chỉnh tần suất quảng cáo

Mở `frontend/public/js/player.js`, tìm:
```javascript
this.adConfig = {
  minutesBeforeAd: 3,  // Thay đổi số phút
  tracksBeforeAd: 2    // Thay đổi số bài
};
```

**Khuyến nghị:**
- Spotify: 30 phút hoặc 6 bài
- Agressive: 2 phút hoặc 2 bài
- Relaxed: 5 phút hoặc 4 bài

---

## 🛠️ Công Cụ Quản Lý

### Liệt kê quảng cáo
```bash
node scripts/manage-ads.js list
```

### Thêm quảng cáo mới
```bash
node scripts/manage-ads.js add
# → Nhập thông tin interactive
```

### Bật/tắt quảng cáo
```bash
node scripts/manage-ads.js toggle <adId>
```

### Xem thống kê
```bash
node scripts/manage-ads.js stats
```

### Toggle Pro status (testing)
```bash
node scripts/manage-ads.js test-pro <userId>
```

---

## 🧪 Test Scenarios

### Scenario 1: Free User - Normal Flow
1. Đăng nhập user Free
2. Phát bài nhạc #1 → Nghe hết (hoặc >30s)
3. Phát bài nhạc #2 → Nghe hết
4. ✅ **Ad xuất hiện** sau bài #2
5. Ad tự động phát → UI overlay hiển thị
6. Ad kết thúc → Resume bài #2 (hoặc next track)

### Scenario 2: Pro User - No Ads
1. Set user thành Pro: `node scripts/manage-ads.js test-pro <userId>`
2. Đăng nhập
3. Nghe 10 bài liên tiếp
4. ✅ **Không có quảng cáo nào**

### Scenario 3: Edge Cases
- **Reload page giữa bài**: State restored, không phát ad ngay
- **Skip bài trước 30s**: Không tăng counter
- **Close browser**: Session reset, lần sau vào lại tính mới

---

## 📊 Monitoring

### Check logs trong browser console
```javascript
// Xem trạng thái
console.log(window.player.isPro);        // true/false
console.log(window.player.adStats);      // Thống kê tracks played
console.log(window.player.isPlayingAd);  // Có đang phát ad không

// Test manually
window.player.playAdvertisement();       // Force play ad
```

### Check database
```bash
# MongoDB shell
db.advertisements.find().pretty()
db.users.find({ isPro: true }).count()
```

---

## 🐛 Troubleshooting

### Quảng cáo không phát
- ✅ Kiểm tra file MP3 tồn tại: `ls frontend/public/uploads/ads/`
- ✅ Kiểm tra DB có ads: `node scripts/manage-ads.js list`
- ✅ Kiểm tra user không phải Pro: Console → `window.player.isPro`
- ✅ Kiểm tra ads.css được load: DevTools → Network → ads.css

### Lỗi 404 khi fetch ad
- ✅ Verify routes: `curl http://localhost:3000/api/ads/get`
- ✅ Check server logs

### Ad không tự động resume
- ✅ Check console errors
- ✅ Verify `pausedTrack` state trong debugger

---

## 📚 Đọc Thêm

Chi tiết đầy đủ xem tại: **[ADVERTISEMENT_SYSTEM.md](./ADVERTISEMENT_SYSTEM.md)**

---

## ✨ Features Highlights

✅ Chỉ Free users bị quảng cáo  
✅ Trigger dựa trên thời gian HOẶC số bài  
✅ Không cho skip khi đang quảng cáo  
✅ Tự động resume sau khi ad kết thúc  
✅ UI overlay đẹp với nút nâng cấp Pro  
✅ Weighted random ads (priority-based)  
✅ Track impressions vào database  
✅ Edge cases handled (reload, skip, errors)  

---

**Chúc implement thành công! 🎉**

Nếu có vấn đề, check logs hoặc đọc [ADVERTISEMENT_SYSTEM.md](./ADVERTISEMENT_SYSTEM.md) để biết thêm chi tiết.
