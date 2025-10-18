# SAOCLAO
### Nền tảng nghe và chia sẻ âm nhạc trực tuyến

---

## Giới thiệu dự án

**SAOCLAO** là một ứng dụng web nghe nhạc lấy cảm hứng từ SoundCloud, được xây dựng với giao diện tối giản **đen – trắng**, mang phong cách hiện đại và tinh tế.

Dự án hướng đến việc tạo ra một không gian âm nhạc trực tuyến nơi người dùng có thể **nghe, đăng tải và khám phá** các bản nhạc, đồng thời **kết nối với cộng đồng** yêu âm nhạc.

Ứng dụng tập trung vào trải nghiệm người dùng đơn giản, hiệu ứng nhẹ nhàng và tính thẩm mỹ cao, phù hợp để triển khai thực tế hoặc sử dụng trong học tập – nghiên cứu về lập trình web fullstack.

---

## Cách cài đặt

### 1. Sao chép mã nguồn về máy
```bash
git clone [https://github.com/ducquyen12312ew/sao_clao.git]
cd Path of your project
```
### 1. Sao chép mã nguồn về máy
```bash
git clone [https://github.com/yourusername/saoclao.git](https://github.com/yourusername/saoclao.git)
cd saoclao
```
### 2.Cài đặt các gói phụ thuộc
```bash
npm install
```
### 3. Tạo file .env tại thư mục gốc của dự án
```bash
MONGO_URI=mongodb://0.0.0.0:27017/MusicCloud
SESSION_SECRET=your_secret_key
PORT=3000
```
```bash
cp .env.example .env
```
### 4. Khởi chạy ứng dụng
```bash
npm start
```