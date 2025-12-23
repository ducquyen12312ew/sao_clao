# 🎵 Hệ Thống Quảng Cáo (Advertisement System)

## 📋 Tổng Quan

Hệ thống quảng cáo chèn giữa bài hát, giống Spotify, chỉ áp dụng cho user **Free** (không phải Pro).

---

## 🏗️ Kiến Trúc Tổng Thể

### Frontend (player.js)
- **Tracking**: Theo dõi số bài đã nghe và thời gian nghe nhạc
- **Trigger**: Quyết định khi nào phát quảng cáo (sau X phút hoặc Y bài)
- **Ad Playback**: Pause track → Play ad → Resume track
- **UI**: Hiển thị overlay quảng cáo với nút nâng cấp Pro

### Backend (Express API)
- **GET /api/ads/get**: Lấy quảng cáo ngẫu nhiên (weighted by priority)
- **GET /api/ads/check-pro**: Kiểm tra user có phải Pro không
- **POST /api/ads/impression/:adId**: Track số lần quảng cáo được phát

### Database (MongoDB)
```javascript
User: {
  isPro: Boolean,          // true = Pro user, false = Free user
  proExpiresAt: Date       // Ngày hết hạn Pro (null = vĩnh viễn)
}

Advertisement: {
  title: String,           // Tên quảng cáo
  audioUrl: String,        // Đường dẫn file MP3
  duration: Number,        // Độ dài (giây)
  isActive: Boolean,       // Bật/tắt quảng cáo
  priority: Number,        // Độ ưu tiên (càng cao càng hay được phát)
  impressions: Number      // Số lần đã phát
}
```

---

## ⚙️ Logic Trigger Quảng Cáo

Quảng cáo được phát khi **một trong hai điều kiện** sau xảy ra:

1. **Thời gian**: Đã nghe nhạc được `X phút` (mặc định: 3 phút)
2. **Số bài**: Đã nghe xong `Y bài` (mặc định: 2 bài)

### Cấu hình trong player.js:
```javascript
this.adConfig = {
  minutesBeforeAd: 3,  // Số phút
  tracksBeforeAd: 2    // Số bài
};
```

### Flow:
```
User nghe nhạc
  ↓
Sau 30s hoặc 50% bài → Track play count
  ↓
tracksPlayed++ 
  ↓
Kiểm tra điều kiện trigger?
  ├─ Đủ X phút HOẶC Y bài? 
  │   ↓ YES
  │   Gọi playAdvertisement()
  │   ↓
  │   Pause track → Lưu state → Play ad
  │   ↓
  │   Ad ended → Resume track từ timestamp cũ
  │
  └─ NO → Tiếp tục nghe nhạc
```

---

## 🎬 Flow Phát Quảng Cáo

### 1. **Pause Track**
```javascript
const currentTime = this.audio.currentTime;
this.pausedTrack = {
  track: this.currentTrack,
  time: currentTime,
  wasPlaying: !this.audio.paused
};
this.audio.pause();
```

### 2. **Fetch & Play Ad**
```javascript
const response = await fetch('/api/ads/get');
const { ad } = await response.json();

this.audio.src = ad.audioUrl;
this.showAdUI(ad);
await this.audio.play();
```

### 3. **Ad Ended → Resume Track**
```javascript
this.audio.addEventListener('ended', () => {
  this.hideAdUI();
  this.audio.src = this.pausedTrack.track.audioUrl;
  this.audio.currentTime = this.pausedTrack.time;
  if (wasPlaying) this.audio.play();
});
```

---

## 🚫 Kiểm Soát Trong Lúc Quảng Cáo

Khi `isPlayingAd = true`:
- ❌ Không cho **Play/Pause**
- ❌ Không cho **Skip** (Next/Previous)
- ❌ Không cho **Seek** (kéo progress bar)
- ✅ Hiển thị **UI overlay** với:
  - Icon quảng cáo
  - Tiêu đề "Đang phát quảng cáo"
  - Progress bar
  - Nút "Nâng cấp Pro"

```javascript
disablePlayerControls() {
  this.playPauseBtn.disabled = true;
  this.prevBtn.disabled = true;
  this.nextBtn.disabled = true;
  this.progressBar.style.pointerEvents = 'none';
}
```

---

## 🎨 UI/UX

### Ad Overlay
- **Background**: Đen mờ với blur backdrop
- **Content**: Icon xanh pulse + tiêu đề + progress bar
- **Button**: Gradient nút Pro với hover effect
- **Animation**: Slide in từ trên xuống

### Responsive
- Desktop: Overlay full screen
- Mobile: Tối ưu padding và font size

---

## 🔧 Setup & Cài Đặt

### 1. Seed Quảng Cáo Vào Database
```bash
# Đặt file MP3 vào folder
/frontend/public/uploads/ads/ad_01.mp3
/frontend/public/uploads/ads/ad_02.mp3
/frontend/public/uploads/ads/ad_03.mp3

# Chạy script seed
node scripts/seed-ads.js
```

### 2. Đánh Dấu User Là Pro
```javascript
// Trong MongoDB hoặc Admin Panel
await UserCollection.findByIdAndUpdate(userId, {
  isPro: true,
  proExpiresAt: null  // hoặc Date trong tương lai
});
```

### 3. Test
- **Free User**: Nghe 2 bài → Quảng cáo xuất hiện
- **Pro User**: Không bao giờ bị quảng cáo

---

## 🐛 Edge Cases & Xử Lý

### 1. **User Reload Page Giữa Chừng**
- ✅ Player restore state từ `localStorage`
- ✅ `adStats` reset (coi như session mới)
- ✅ Không phát ad ngay khi reload

### 2. **User Skip Bài Khi Đang Phát**
- ✅ Track play chỉ được count sau 30s hoặc 50% bài
- ✅ Skip trước đó → không tăng counter

### 3. **User Nâng Cấp Pro Giữa Session**
```javascript
// Sau khi nâng cấp, refresh hoặc:
await player.checkProStatus();
// isPro = true → không phát ad nữa
```

### 4. **Không Có Quảng Cáo Trong DB**
```javascript
if (!data.ad) {
  // Không làm gì, tiếp tục phát nhạc bình thường
  return;
}
```

### 5. **Lỗi Khi Load Ad (404, Network)**
```javascript
catch (error) {
  console.error('Error playing ad:', error);
  this.isPlayingAd = false;
  this.resumeAfterAd(); // Resume track ngay lập tức
}
```

### 6. **User Đóng Tab Khi Đang Ad**
- ✅ Không ảnh hưởng, lần sau vào lại → session mới

---

## 📊 Tracking & Analytics

### Metrics Có Sẵn
- **impressions**: Số lần mỗi ad được phát (trong DB)
- **adStats.tracksPlayed**: Số bài user đã nghe (trong session)
- **adStats.lastAdTime**: Timestamp lần cuối phát ad

### Mở Rộng (Optional)
Bạn có thể thêm:
- Track ad **completion rate** (user có nghe hết ad không)
- Track ad **skip attempts** (nếu user cố skip)
- A/B testing nhiều ads khác nhau

---

## 🎯 Tối Ưu & Best Practices

### 1. **Chất Lượng Audio Ad**
- Format: MP3, 128kbps+
- Độ dài: 15-30s (không quá dài)
- Volume: Normalize với tracks để không quá to/nhỏ

### 2. **Tần Suất Quảng Cáo**
```javascript
// Nên điều chỉnh dựa trên feedback user:
minutesBeforeAd: 3,  // Spotify dùng ~30 phút/ad
tracksBeforeAd: 2    // Hoặc mỗi 3-5 bài
```

### 3. **Priority Ads**
```javascript
// Ads quan trọng hơn → priority cao hơn
{ title: 'Promo mới', priority: 10 }   // 10/15 = 66% chance
{ title: 'Ad thường', priority: 5 }    // 5/15 = 33% chance
```

### 4. **Caching**
- Ad list có thể cache ở client (giảm API calls)
- Reload mỗi 5-10 phút hoặc khi cần

---

## 📝 API Reference

### GET `/api/ads/get`
**Response:**
```json
{
  "success": true,
  "ad": {
    "id": "abc123",
    "title": "Nâng cấp Pro",
    "audioUrl": "/public/uploads/ads/ad_01.mp3",
    "duration": 15
  }
}
```

### GET `/api/ads/check-pro`
**Response:**
```json
{
  "isPro": false
}
```

---

## 🚀 Triển Khai Production

### 1. **CDN cho Ads**
- Upload ads lên S3/Cloudinary
- Update `audioUrl` trong DB

### 2. **Rate Limiting**
- Giới hạn API calls `/api/ads/get` (vd: 10 requests/phút/user)

### 3. **Monitoring**
- Log ad plays
- Alert nếu ad fetch fail rate > 5%

---

## 🔮 Future Enhancements

1. **Targeted Ads**: Quảng cáo theo thể loại nhạc user nghe
2. **Reward Ads**: Xem ad → được 1h Pro miễn phí
3. **Video Ads**: Ngoài audio, thêm video ads
4. **Ad Scheduler**: Schedule ads theo giờ/ngày
5. **Admin Panel**: Quản lý ads qua web UI

---

## 🤝 Hỗ Trợ

Nếu gặp vấn đề:
1. Check console logs: `player.isPro`, `player.adStats`
2. Test API: `curl http://localhost:3000/api/ads/get`
3. Verify DB: `db.advertisements.find({})`

---

**Chúc implement thành công! 🎉**
