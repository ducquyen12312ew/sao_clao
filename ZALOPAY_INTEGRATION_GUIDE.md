# 🎵 ZaloPay Sandbox Integration Guide

## 📋 Tổng Quan

Hệ thống thanh toán ZaloPay cho gói Pro SAOCLAO:
- ✅ Tích hợp ZaloPay Sandbox (v2 API)
- ✅ HMAC SHA256 MAC verification
- ✅ Cộng dồn thời gian Pro
- ✅ Tránh F5 spam
- ✅ Lưu history transaction
- ✅ Callback verify từ ZaloPay

---

## 🏗️ Kiến Trúc

### Frontend
- `pro.ejs` - Trang hiển thị 2 gói (tháng/năm)
- Button submit form POST `/pro/pay`

### Backend
```
Routes:
  GET  /pro              → Hiển thị trang Pro
  POST /pro/pay          → Tạo ZaloPay payment
  GET  /pro/zalo-callback → Verify callback + update user
  GET  /pro/history      → Xem lịch sử transaction

Services:
  /backend/services/zalopay.js → ZaloPay logic (tạo URL, verify)

Database:
  Transaction model → Lưu lịch sử thanh toán
  User.isPro + User.proExpiredAt → Trạng thái Pro
```

---

## 🔐 ZaloPay Setup (Sandbox)

### Sử Dụng Test Credentials

ZaloPay cung cấp sandbox credentials sẵn để test:

```env
ZALO_APPID=554
ZALO_KEY1=8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn
ZALO_KEY2=uUfsWgfLkRLzq6W2uNXTCxrfxs51auny
ZALO_ENDPOINT=https://sandbox.zalopay.com.vn/v001/tpe/createorder
ZALO_CALLBACK_URL=http://localhost:3000/pro/zalo-callback
APP_URL=http://localhost:3000
```

### Cập nhật .env

```env
# Đã có sẵn sandbox credentials
ZALO_APPID=554
ZALO_KEY1=8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn
ZALO_KEY2=uUfsWgfLkRLzq6W2uNXTCxrfxs51auny
ZALO_ENDPOINT=https://sandbox.zalopay.com.vn/v001/tpe/createorder
ZALO_CALLBACK_URL=http://localhost:3000/pro/zalo-callback
APP_URL=http://localhost:3000
```

**Lưu ý:**
- AppID `554` là test merchant của ZaloPay
- Key1 dùng để tạo signature khi request
- Key2 dùng để verify callback từ ZaloPay
- Để production: Đăng ký tại https://developer.zalopay.vn/

---

## 📊 Luồng Thanh Toán

```
┌─────────────┐
│   User      │
│ (/pro page) │
└──────┬──────┘
       │ 1. Chọn gói (monthly/yearly)
       │    Click "Bắt đầu (ZaloPay)"
       │
       ▼
┌──────────────────────────┐
│ POST /pro/pay            │
│ - Validate plan          │
│ - Tạo order ID           │
│ - Save transaction       │
│ - Tạo ZaloPay URL        │
│ - Redirect sang ZaloPay  │
└──────────┬───────────────┘
           │ 2. Redirect to ZaloPay
           │    QR code hoặc app payment
           │
           ▼
┌──────────────────────────┐
│   ZaloPay Sandbox        │
│   - User scans QR        │
│   - Hoặc ZaloPay app     │
│   - Xác nhận thanh toán  │
│   - Callback to server   │
└──────────┬───────────────┘
           │ 3. GET /pro/zalo-callback
           │    ZaloPay server gửi callback
           │
           ▼
┌──────────────────────────┐
│ GET /pro/zalo-callback   │
│ - Verify MAC signature   │
│ - Check return code      │
│ - Update transaction     │
│ - If success:            │
│   - Set user.isPro=true  │
│   - Set proExpiredAt     │
│   - Show success page    │
└──────────┬───────────────┘
           │ 4. Auto redirect /home
           │    (after 5 seconds)
           │
           ▼
┌─────────────────────┐
│   User Home Page    │
│   With Pro Status   │
└─────────────────────┘
```

---

## 🔧 Key Features

### 1. **Tạo Payment URL**

File: `backend/services/zalopay.js`

```javascript
const paymentResult = await zaloPayService.createPaymentUrl({
  userId,
  plan: 'monthly',      // or 'yearly'
  amount: 15000,        // VND
  orderId: 'SAO123...',
  ipAddress: '...',
  userAgent: '...'
});

// paymentResult: { success: true, paymentUrl: '...', data: {...} }
```

**Tính toán MAC (Signature):**
```
dataStr = `${appId}|${appTransactionId}|${userId}|${amount}|${embedData}|${item}`
mac = HMAC-SHA256(dataStr, key1)
```

### 2. **Verify Callback**

ZaloPay gửi callback với query params:
```
appid, app_trans_id, zalo_trans_id, amount, return_code, return_message, timestamp, mac
```

Verify MAC:
```javascript
const verifyResult = zaloPayService.verifyCallback(req.query);
// { isValid: true/false, returnCode, amount, zaloTransactionId, ... }

if (verifyResult.isValid) {
  // MAC ok
}
```

### 3. **Return Codes ZaloPay**

| Code | Meaning | Pro Status |
|------|---------|-----------|
| `1` | Thành công | ✅ Grant |
| Khác | Thất bại | ❌ Không grant |

---

## 💾 Database Schema (Transaction)

```javascript
{
  userId: ObjectId,                    // User mua
  transactionCode: String,             // Order ID (SAO123...)
  plan: 'monthly' | 'yearly',
  amount: Number,                      // VND
  currency: 'VND',
  status: 'pending'|'success'|'failed',
  gateway: 'zalopay',                  // Dùng ZaloPay
  
  // ZaloPay fields
  zaloOrderId: String,                 // Order ID từ ZaloPay
  zaloReturnCode: Number,              // Return code (1 = success)
  zaloTransactionId: String,           // Transaction ID từ ZaloPay
  
  proExpiryDays: Number,               // 30 or 365
  proExpiredAt: Date,                  // Khi nào hết Pro
  
  ipAddress: String,
  userAgent: String,
  errorMessage: String,                // If failed
  
  createdAt: Date (indexed),           // Order created
  completedAt: Date                    // Transaction completed
}
```

---

## 🚀 Testing

### Test Case 1: Successful Payment

1. Vào `/pro`
2. Chọn gói Tháng (15.000 VND)
3. Click "Bắt đầu (ZaloPay)"
4. Ở ZaloPay sandbox: Scan QR hoặc xác nhận
5. ✅ Redirect về success page
6. Check user.isPro = true

### Test Case 2: Failed Payment

1. Tại ZaloPay, chọn "Hủy giao dịch"
2. ✅ Redirect về failed page
3. Check user.isPro = false (unchanged)

### Test Case 3: Extend Pro

1. User có Pro expiry: 2025-12-25
2. Thanh toán gói tháng
3. New expiry: 2026-01-25 ✅ (cộng 30 ngày từ cũ)

### Test Case 4: F5 Spam

1. Thanh toán thành công → success page
2. F5 refresh
3. ✅ Vẫn hiển thị success (không xử lý lại)

---

## 🐛 Lỗi Thường Gặp

| Lỗi | Nguyên nhân | Cách Fix |
|-----|-----------|---------|
| **"Chữ ký không hợp lệ"** | Key sai hoặc signature format sai | Check ZALO_KEY1 và ZALO_KEY2 |
| **"Không tìm thấy đơn hàng"** | Order ID không lưu | Check DB Transaction collection |
| **Callback không nhận** | URL không đúng | Verify ZALO_CALLBACK_URL |
| **User không Pro** | Transaction status chưa update | Check /zalo-callback response handling |
| **F5 lặp lại payment** | Status check missing | Kiểm tra `transaction.status !== 'pending'` |

---

## 📝 Code Example

### Tạo Payment (Frontend)

```html
<!-- pro.ejs -->
<form method="POST" action="/pro/pay">
  <input type="hidden" name="plan" value="monthly">
  <button type="submit" class="btn btn-primary">
    Bắt đầu (ZaloPay)
  </button>
</form>
```

### Verify Callback (Backend)

```javascript
// pro.js - GET /pro/zalo-callback
router.get('/zalo-callback', async (req, res) => {
  const verifyResult = zaloPayService.verifyCallback(req.query);
  
  if (!verifyResult.isValid) {
    return res.render('payment-result', {
      success: false,
      message: 'Chữ ký không hợp lệ'
    });
  }

  const transaction = await TransactionCollection.findOne({
    transactionCode: req.query.app_trans_id
  });

  if (verifyResult.returnCode === 1) {
    // ✅ Thành công
    transaction.status = 'success';
    user.isPro = true;
    user.proExpiredAt = newDate;
    await user.save();

    return res.render('payment-result', {
      success: true,
      message: 'Nâng cấp Pro thành công! 🎉'
    });
  } else {
    // ❌ Thất bại
    transaction.status = 'failed';
    return res.render('payment-result', {
      success: false,
      message: 'Giao dịch thất bại'
    });
  }
});
```

---

## 🔍 Monitoring

### Check Transaction

```bash
db.transactions.find({ gateway: 'zalopay' })
# Xem tất cả giao dịch ZaloPay

db.transactions.find({ status: 'success', gateway: 'zalopay' })
# Check success transactions

db.users.find({ isPro: true }).count()
# Số Pro users
```

### Logs

Server logs sẽ in:
```
[ZaloPay] Creating payment request: orderId: SAO1234..., amount: 15000, plan: monthly
[ZaloPay] Response: returnCode: 1, paymentUrl: present
[ZaloPay] Payment URL created for order SAO1234...
[ZaloPay Callback] AppTransId: SAO1234..., ReturnCode: 1, Valid: true
[Pro] Activated Pro for user john, expires: 2025-12-23T10:30:00Z
[ZaloPay Success] User john paid 15000 VND for monthly
```

---

## ✅ Checklist Deploy to Production

- [ ] Đăng ký ZaloPay production account tại https://developer.zalopay.vn/
- [ ] Lấy AppID, Key1, Key2 (production)
- [ ] Update .env: 
  - `ZALO_APPID=YOUR_PRODUCTION_APPID`
  - `ZALO_KEY1=YOUR_PRODUCTION_KEY1`
  - `ZALO_KEY2=YOUR_PRODUCTION_KEY2`
  - `ZALO_ENDPOINT=https://zalopay.com.vn/v001/tpe/createorder` (production)
  - `ZALO_CALLBACK_URL=https://yourdomain.com/pro/zalo-callback`
  - `APP_URL=https://yourdomain.com`
- [ ] Test với sandbox tài khoản 1 lần trước deploy
- [ ] Enable HTTPS (ZaloPay yêu cầu)
- [ ] Monitor transaction logs
- [ ] Backup DB trước deploy

---

## 📞 Support

### ZaloPay Docs
- Trang chủ: https://zalopay.com/
- Developer: https://developer.zalopay.vn/
- API Docs: https://developer.zalopay.vn/api-references
- Status Page: https://status.zalopay.vn/

### Sandbox Credentials
```
AppID: 554
Key1: 8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn
Key2: uUfsWgfLkRLzq6W2uNXTCxrfxs51auny
```

---

**Status**: ✅ Hoàn chỉnh và sẵn sàng test!

## Tips & Tricks

### Amount Calculation
- Input: 15000 VND (monthly)
- ZaloPay: 15000 × 100 = 1500000 (trong request)
- DB: Lưu 15000 (original)

### Callback Signature Format
ZaloPay dùng format riêng, khác VNPay:
```
dataStr = `${appId}|${appTransactionId}|${zaloTransactionId}|${amount}|${appUser}|${timestamp}`
mac = HMAC-SHA256(dataStr, key2)
```

### Testing Payment
1. Sandbox URL: https://sandbox.zalopay.com.vn/
2. Dùng app ZaloPay hoặc quét QR
3. Hoàn thành payment → callback tự động gửi
4. Check server logs để verify callback đã nhận

### Return Code Meanings
- `1` = Success (money received)
- `-1` = Unknown error
- `-2` = Invalid signature
- `-3` = Insufficient balance
- `-4` = Duplicate transaction

---

Bạn đã sẵn sàng để test ZaloPay! 🎉
