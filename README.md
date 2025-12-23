# SAOCLAO
### Nền tảng nghe và chia sẻ nhạc trực tuyến

---

## Giới thiệu

**SAOCLAO** là một ứng dụng web nghe nhạc lấy cảm hứng từ SoundCloud, được xây dựng với giao diện tối giản **đen – trắng**, mang phong cách hiện đại và tinh tế.

---

## Cài đặt

### 1. Sao chép mã nguồn
```bash
git clone https://github.com/ducquyen12312ew/sao_clao.git
cd sao_clao
```

### 2. Cấu trúc thư mục
- `backend/`: mã nguồn Node/Express, routes, cấu hình DB, script seed admin.
- `frontend/`: `views/` (EJS) và `public/` (CSS/JS/ảnh) được server phục vụ statically.
- `scripts/`: công cụ import nhạc từ YouTube.

### 3. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 4. Tạo file .env tại thư mục gốc
```bash
cp .env.example .env
```

Thêm cấu hình sau:
```env
# MongoDB Atlas hoặc local
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/MusicCloud?retryWrites=true&w=majority
SESSION_SECRET=your_secret_key
PORT=3000

# Cloudinary (bắt buộc để upload audio + cover)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_DEFAULT_COVER_URL=
AI_SERVICE_URL=http://127.0.0.1:8000/generate
AI_MODEL_PATH=./ai-service/model_saved
SOUNDFONT_PATH=/usr/share/sounds/sf2/FluidR3_GM.sf2
TMP_DIR=

# OAuth (bật nếu muốn đăng nhập Google/Facebook)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
APP_BASE_URL=http://localhost:3000

# SMTP (Gmail/app password) để gửi mail reset password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

### 5. Khởi chạy backend
```bash
npm start
```
Server mặc định chạy port 3000 và phục vụ view/static từ `frontend/`.
- Mật khẩu khi đăng ký/đặt lại: tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.

### 6. Seed tài khoản admin (tùy chọn)
```bash
node backend/seed-admins.js
```

---

## Tài khoản Admin

**Tài khoản:** `admin1` `admin2` `admin3`  
**Mật khẩu:** `admin123`

---

## Import Nhạc từ YouTube

### Yêu cầu

Để import nhạc từ YouTube, bạn cần cài đặt:

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp/releases)** - Tải [yt-dlp.exe](https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe)
- **[ffmpeg](https://www.gyan.dev/ffmpeg/builds/)** - Tải [ffmpeg-release-essentials.zip](https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip)

### Cài đặt

Tạo cấu trúc thư mục sau:
```
D:\yt-dlp\yt-dlp.exe
D:\ffmpeg-8.0-essentials_build\ffmpeg-8.0-essentials_build\bin\ffmpeg.exe
```

> **Lưu ý:** Nếu phiên bản ffmpeg khác hoặc đường dẫn khác, hãy cập nhật trong file `scripts/import-one.js` và `scripts/import-batch.js`

---

### Phương thức 1: Import từng bài (import-one.js)

Import một bài hát từ YouTube:

```bash
node scripts/import-one.js "<YouTube_URL>" <username> [audio|video] [max_duration_seconds]
```

**Ví dụ:**

```bash
# Import audio (mặc định)
node scripts/import-one.js "https://www.youtube.com/watch?v=ZlvAZsA3Nuc" quynhchi

# Import audio (rõ ràng)
node scripts/import-one.js "https://www.youtube.com/watch?v=ZlvAZsA3Nuc" quynhchi audio

# Import video MV (toàn bộ)
node scripts/import-one.js "https://www.youtube.com/watch?v=ZlvAZsA3Nuc" quynhchi video

# Import video MV (chỉ 90 giây đầu)
node scripts/import-one.js "https://www.youtube.com/watch?v=ZlvAZsA3Nuc" quynhchi video 90
```

---

### Phương thức 2: Import hàng loạt (import-batch.js)

Import nhiều bài hát cùng lúc từ file danh sách URL.

#### Bước 1: Tạo file danh sách URL

Tạo file `urls.txt` với mỗi dòng là một URL YouTube:

```
https://www.youtube.com/watch?v=ZlvAZsA3Nuc
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://www.youtube.com/watch?v=kJQP7kiw5Fk
```

#### Bước 2: Chạy lệnh import batch

```bash
node scripts/import-batch.js <urls_file.txt> <username> [audio|video] [max_duration_seconds]
```

**Ví dụ:**

```bash
# Import tất cả thành audio
node scripts/import-batch.js urls.txt quynhchi audio

# Import tất cả thành video MV (90 giây mỗi video)
node scripts/import-batch.js urls.txt quynhchi video 90

# Import tất cả thành video MV (toàn bộ)
node scripts/import-batch.js urls.txt quynhchi video
```

## Công nghệ sử dụng

- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Storage:** Cloudinary
- **Audio/Video Processing:** yt-dlp, ffmpeg
- **Frontend:** EJS, CSS

## AI Generate nhạc (tùy chọn)

1) Chạy service AI (FastAPI) trong repo:
```
cd ai-service
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```
Biến môi trường: 
- `AI_MODEL_PATH` (bắt buộc): file `.keras`/`.h5` hoặc thư mục SavedModel (app dùng `TFSMLayer` để load inference-only). 
- `SOUNDFONT_PATH` (mặc định /usr/share/sounds/sf2/FluidR3_GM.sf2), `TMP_DIR` (tùy chọn).
Yêu cầu tool: `fluidsynth` + `ffmpeg` có trong PATH.

2) Cấu hình `.env` web: `AI_SERVICE_URL` trỏ tới `http://127.0.0.1:8000/generate` (hoặc host/port bạn chạy), Cloudinary giữ nguyên.

3) Sử dụng trên web:
- Đăng nhập -> vào `/ai`.
- Upload MIDI hoặc audio (mp3/wav/m4a/flac/ogg), nhập thời lượng (5–120 giây) và temperature (0.2–2.0).
- Server Node gửi file sang AI service; service chuyển audio -> MIDI (basic-pitch), chọn instrument chính, load model TensorFlow tại `AI_MODEL_PATH`, sinh continuation, render MP3 qua fluidsynth + ffmpeg.
- Node upload MP3 lên Cloudinary (resource_type video, folder `saoclai/generated`), tạo Track mới (status approved, đánh dấu `aiGenerated`) và chuyển sang trang track.

Nếu thiếu model hoặc thiếu fluidsynth/ffmpeg/soundfont, service trả lỗi rõ ràng, không crash web.

---
