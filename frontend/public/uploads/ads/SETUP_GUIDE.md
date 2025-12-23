# Sample Ad Files

Vì không thể tạo file MP3 thực trong môi trường này, bạn cần tự tạo hoặc tải về các file quảng cáo.

## Cách Tạo File Quảng Cáo Test

### Option 1: Sử dụng Text-to-Speech Online
1. Truy cập: https://ttsmp3.com/
2. Nhập text:
   ```
   "Nâng cấp lên SAOCLAO Pro để nghe nhạc không quảng cáo. 
   Trải nghiệm cao cấp chỉ với 49.000đ mỗi tháng."
   ```
3. Chọn giọng Tiếng Việt
4. Download file MP3
5. Đổi tên thành `ad_01.mp3`

### Option 2: Sử dụng Audacity (Free)
1. Download Audacity: https://www.audacityteam.org/
2. Generate → Tone... → 15 seconds (tạo tiếng bíp)
3. File → Export → Export as MP3
4. Lưu vào `/frontend/public/uploads/ads/`

### Option 3: Sử dụng ffmpeg (Command line)
```bash
# Tạo file silent 15s
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 15 -acodec libmp3lame ad_01.mp3

# Hoặc tạo với tone
ffmpeg -f lavfi -i "sine=frequency=1000:duration=15" ad_01.mp3
```

## Cấu Trúc Folder

```
frontend/public/uploads/ads/
├── ad_01.mp3  (15s - "Nâng cấp Pro")
├── ad_02.mp3  (20s - "SAOCLAO Premium")
└── ad_03.mp3  (15s - "Khám phá tính năng mới")
```

## Quick Setup (Windows PowerShell)

```powershell
# Tạo 3 file test với ffmpeg (nếu đã cài)
cd d:\GITHUB\sao\frontend\public\uploads\ads
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 15 -acodec libmp3lame ad_01.mp3
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 20 -acodec libmp3lame ad_02.mp3
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 15 -acodec libmp3lame ad_03.mp3
```

Sau khi có file, chạy:
```bash
node scripts/seed-ads.js
```
