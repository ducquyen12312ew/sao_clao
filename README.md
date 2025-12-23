# SAOCLAO
Nền tảng nghe và chia sẻ nhạc trực tuyến (nhỏ, demo/prototype)

Mục tiêu: một web app cho phép người dùng upload, nghe, chia sẻ và báo cáo bài hát; admin có thể quản lý nội dung. Dự án này là một bản demo/learning project và bao gồm cả công cụ import nhạc từ YouTube, và player client-side.

---

## Mục lục

- [Giới thiệu](#giới-thiệu)
- [Cài đặt nhanh](#cài-đặt-nhanh)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Kiến trúc & luồng dữ liệu](#kiến-trúc--luồng-dữ-liệu)
- [Frontend (FE)](#frontend-fe)
- [Backend (BE)](#backend-be)
- [Import nhạc từ YouTube](#import-nhạc-từ-youtube)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Phát triển & debug nhanh](#phát-triển--debug-nhanh)

---

## Giới thiệu

SAOCLAO là một ứng dụng web demo cho phép người dùng nghe và chia sẻ nhạc, upload file audio/covers, tạo playlist, like/comment và report tracks. Admin có thể duyệt/approve/reject nội dung. Ứng dụng thích hợp để học tập về stack Node.js + Express + EJS, upload media (Cloudinary), và xử lý audio/video bằng yt-dlp + ffmpeg.

## Cài đặt nhanh

1. Clone repository và chuyển vào thư mục:

```bash
git clone https://github.com/ducquyen12312ew/sao_clao.git
cd sao_clao
```

2. Cài đặt phụ thuộc và tạo file `.env`:

```bash
npm install
cp .env.example .env
```

3. Chỉnh `.env` theo môi trường của bạn (MongoDB, Cloudinary, SMTP, AI service...). Xem phần env mẫu trong file `.env.example`.


4. Khởi chạy server:

```bash
npm start
```

Mặc định server chạy trên `http://localhost:3000` và phục vụ view/static từ `frontend/`.

## Cấu trúc dự án

Gần như toàn bộ mã nguồn được tách thành hai phần chính:

- `backend/` — Node.js/Express app, routes, controllers, models, cấu hình DB.
- `frontend/` — EJS templates (`views/`) và tài nguyên tĩnh (`public/` gồm CSS/JS/images/uploads).
- `scripts/` — tiện ích import nhạc (import-one.js, import-batch.js) sử dụng `yt-dlp` + `ffmpeg`.

## Kiến trúc & luồng dữ liệu

- Client (browser) request page → Server Express render EJS template (kèm dữ liệu từ MongoDB).
- Upload audio/cover: client gửi file → backend upload lên Cloudinary → lưu metadata URL trong MongoDB.
- Player: client sử dụng `player.js` (simple audio player) để load và điều khiển audio từ Cloudinary URLs.
- Comments/likes/reports: REST endpoints xử lý thao tác, server trả JSON cho client-side JS (fetch/XHR).

### Bảo mật & quyền

- Các route cần xác thực (upload, comment, like) yêu cầu session/cookie. Sử dụng `SESSION_SECRET` trong `.env`.
- Admin-only routes (approve/reject/delete) kiểm tra role trên server trước khi thực thi.

## Frontend (FE)

- Template engine: EJS.
- Tài nguyên tĩnh: `frontend/public/` — chứa `css/`, `js/`, `img/`, `uploads/`.
- Nguyên tắc khi truyền dữ liệu server→client:
	- Dùng `<%- JSON.stringify(obj) %>` hoặc `type="application/json"` script tag để inject dữ liệu lớn/an toàn.
	- Tránh chèn trực tiếp EJS expression vào inline JS/CSS nếu dữ liệu chứa backticks/dollars.

## Backend (BE)

- Framework: Express.js.
- DB: MongoDB (mongoose models in `backend/`).
- Storage: Cloudinary for media hosting.
- Các router chính: users, tracks, playlists, admin, upload, settings.

## Import nhạc từ YouTube

Hướng dẫn cách sử dụng `scripts/import-one.js` và `scripts/import-batch.js`.

### Yêu cầu

- **yt-dlp** — để download audio/video từ YouTube
- **ffmpeg** — để convert/trim/render audio/video

### Ví dụ import 1 bài

```bash
node scripts/import-one.js "<YouTube_URL>" <username> [audio|video] [max_duration_seconds]
```

### Import hàng loạt (batch)

1. Tạo `urls.txt` (mỗi dòng 1 URL)
2. Chạy:

```bash
node scripts/import-batch.js urls.txt <username> [audio|video] [max_duration_seconds]
```

Xem trong `scripts/` để biết chi tiết và tuỳ chỉnh đường dẫn `ffmpeg`/`yt-dlp` nếu cần.

## Công nghệ sử dụng

- Node.js, Express.js
- EJS
- MongoDB (Mongoose)
- Cloudinary (media hosting)
- yt-dlp, ffmpeg (media processing)
- FastAPI (AI service, optional)

## Phát triển & debug nhanh

- Frontend: sửa files trong `frontend/views` hoặc `frontend/public` → refresh trình duyệt.
- Backend: `npm start` để chạy server. Kiểm tra logs để xem lỗi runtime.
- Nếu buttons không thể click trên một trang: mở DevTools → Console và Elements và chạy `document.elementFromPoint(x,y)` để xem phần tử chặn.


