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

### 2. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 3. Tạo file .env tại thư mục gốc
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
```

### 4. Khởi chạy ứng dụng
```bash
npm start
```

Ứng dụng sẽ chạy tại `http://localhost:3000`

---

## Tài khoản Admin

**Tài khoản:** `admin1` `admin2` `admin3`  
**Mật khẩu:** `admin123`

---

## Cấu hình Import từ YouTube

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

> **Lưu ý:** Nếu phiên bản ffmpeg khác, hãy cập nhật đường dẫn trong `scripts/import-one.js`

### Sử dụng

Import một bài hát từ YouTube:

```bash
node scripts/import-one.js "<YouTube_URL>" <username>
```

**Ví dụ:**

```bash
node scripts/import-one.js "https://www.youtube.com/watch?v=ZlvAZsA3Nuc" quynhchi
```

---

## Công nghệ sử dụng

- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Storage:** Cloudinary
- **Audio Processing:** yt-dlp, ffmpeg
- **Frontend:** EJS, CSS

---

## License

Dự án này là mã nguồn mở và có sẵn theo [giấy phép MIT](LICENSE).