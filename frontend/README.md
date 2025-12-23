README — Frontend assets for SAOCLAO
===================================

Tổng quan
---------
Thư mục `frontend/` chứa toàn bộ tài nguyên giao diện cho ứng dụng SAOCLAO. Đây là phần tĩnh và các template EJS được server Express render trực tiếp. Dự án không có bước build cho frontend; thay đổi trong thư mục này sẽ được server backend tải lại ngay khi bạn refresh trang (với server đang chạy).

Cấu trúc chính
---------------
- `public/` — tệp tĩnh được phục vụ tại đường dẫn `/public`:
	- `css/` — file stylesheet cho các trang (ví dụ `track.css`, `playlist.css`).
	- `js/` — mã javascript client-side (ví dụ `player.js`, `track-detail.js`).
	- `img/` — ảnh và biểu tượng dùng trong giao diện.
	- `uploads/` — file upload (audio, avatars, covers) — được lưu ở đây trong workspace.
- `views/` — các EJS template (server-side rendering) cho từng route. Ví dụ: `track-detail.ejs`, `home.ejs`, `playlist-detail.ejs`.

Nguyên tắc và chú ý khi chỉnh sửa
----------------------------------
- Tránh chèn trực tiếp token EJS vào chuỗi JavaScript hay CSS đặt trong thẻ `<script>` / `<style>` vì có thể gây lỗi parse (đặc biệt nếu nội dung chứa backtick, `${}` hoặc dấu nháy). Thay vào đó:
	- Dùng `<%- JSON.stringify(obj) %>` để inject dữ liệu JSON an toàn rồi parse ở client, hoặc
	- Gán giá trị vào `data-*` attributes và đọc từ DOM khi script chạy.
- Luôn attach event listeners sau khi DOM sẵn sàng (ví dụ trong `DOMContentLoaded` hoặc bằng delegation) để tránh `null` khi query element chưa tồn tại.
- Khi tạo modal/overlay, đảm bảo overlay chỉ hiển thị (và nhận pointer-events) khi modal active; overlay vô tình luôn hiển thị có thể chặn tất cả tương tác.

Chạy và debug nhanh
-------------------
1. Khởi động backend (project root chứa `backend/`):

```bash
cd backend
npm install   # nếu cần
npm start
```

2. Mở trình duyệt và truy cập các route, ví dụ: `http://localhost:3000/track/<id>`


README — Frontend assets for SAOCLAO
===================================

Tổng quan
---------

Thư mục `frontend/` chứa toàn bộ tài nguyên giao diện cho ứng dụng SAOCLAO. Đây là phần tĩnh và các template EJS được server Express render trực tiếp. Dự án không có bước build cho frontend; thay đổi trong thư mục này sẽ được server backend tải lại ngay khi bạn refresh trang (với server đang chạy).

Cấu trúc chính
---------------

- `public/` — tệp tĩnh được phục vụ tại đường dẫn `/public`:
	- `css/` — file stylesheet cho các trang (ví dụ `track.css`, `playlist.css`).
	- `js/` — mã JavaScript client-side (ví dụ `player.js`, `track-detail.js`).
	- `img/` — ảnh và biểu tượng dùng trong giao diện.
	- `uploads/` — file upload (audio, avatars, covers) — được lưu ở đây trong workspace.
- `views/` — các EJS template (server-side rendering) cho từng route. Ví dụ: `track-detail.ejs`, `home.ejs`, `playlist-detail.ejs`.

Nguyên tắc và chú ý khi chỉnh sửa
----------------------------------

- Tránh chèn trực tiếp token EJS vào chuỗi JavaScript hay CSS đặt trong thẻ `<script>` / `<style>` vì có thể gây lỗi parse (đặc biệt nếu nội dung chứa backtick, `${}` hoặc dấu nháy). Thay vào đó:
	- Dùng `<%- JSON.stringify(obj) %>` để inject dữ liệu JSON an toàn rồi parse ở client, hoặc
	- Gán giá trị vào `data-*` attributes và đọc từ DOM khi script chạy.
- Luôn attach event listeners sau khi DOM sẵn sàng (ví dụ trong `DOMContentLoaded` hoặc bằng delegation) để tránh `null` khi query element chưa tồn tại.
- Khi tạo modal/overlay, đảm bảo overlay chỉ hiển thị (và nhận pointer-events) khi modal active; overlay vô tình luôn hiển thị có thể chặn tất cả tương tác.

Chạy và debug nhanh
-------------------

1. Khởi động backend (project root chứa `backend/`):

```bash
cd backend
npm install   # nếu cần
npm start
```

2. Mở trình duyệt và truy cập các route, ví dụ: `http://localhost:3000/track/<id>`

3. Debug frontend:
	- Mở DevTools (Cmd+Option+I trên macOS) → Console / Network / Elements để kiểm tra lỗi JS, request, và DOM.
	- Nếu sửa template EJS, chỉ cần refresh trang để nhận thay đổi.

Phần template (EJS)
-------------------

- Các template nằm trong `views/`. Mỗi file EJS có thể chứa HTML, các tag EJS (`<% %>`, `<%= %>`, `<%- %>`), và liên kết tới file JS/CSS trong `public/`.
- Khi cần truyền object từ server sang client, ưu tiên dùng:

```ejs
<script id="data" type="application/json"><%- JSON.stringify(serverObject) %></script>
<script>
	const data = JSON.parse(document.getElementById('data').textContent);
	// dùng data ở đây
</script>
```

Conventions (tóm tắt)
---------------------

- JS client-side: giữ code trong `public/js/*` thay vì nhúng quá nhiều script inline.
- CSS: giữ styles trong `public/css/*` và tránh đặt JS trong `style`.
- Tên class/id: dùng kiểu `kebab-case` cho CSS classes và `camelCase` cho biến JS.

Thêm file tĩnh mới
-------------------

- Đặt file vào `public/css`, `public/js` hoặc `public/img` tương ứng.
- Trong template, tham chiếu bằng đường dẫn `/public/...`, ví dụ:
	`<script src="/public/js/my-script.js"></script>`

Vấn đề thường gặp & cách khắc phục
---------------------------------

- Lỗi parse EJS trong script: thường do chèn backtick hoặc `${...}`; giải pháp: dùng JSON blob (xem mục "Phần template").
- Buttons không thể click (page "bị khoá"): kiểm tra xem có overlay/full-screen element nào che phủ không (kiểm tra bằng `document.elementFromPoint(x,y)` trong Console). Sửa CSS z-index hoặc pointer-events cho overlay.
- Lỗi CORS hoặc static files 404: đảm bảo backend đang cấu hình serve static `public` folder và đường dẫn `/public` đúng.

---
File này là tài liệu ngắn để giúp contributor hiểu cấu trúc và các quy tắc khi làm việc với phần frontend của SAOCLAO.
