# 📚 ZaloPay API Complete Reference Guide

**Last Updated:** December 23, 2025  
**Source:** Official ZaloPay Documentation + Project Implementation Analysis

---

## 🎯 Quick Answers to Your Questions

### 1. **Parameter Names Format: `snake_case` ✅**

**Request Parameters (sent to ZaloPay) use `snake_case`:**
```javascript
{
  app_id: 554,
  app_time: 1703664998490,
  app_trans_id: "231227_554_1703664997117",
  app_user: "user123",
  amount: 1500000,        // Amount x 100
  description: "Payment",
  item: "[]",
  embed_data: "{...}",
  redirect_url: "http://localhost:3000",
  mac: "0336b57f74209f3b944c88b8fc8c878ae518d20b7e88763fb2ff9e14e6c3cac5"
}
```

### 2. **Is `app_time` Required in MAC Calculation? YES ✅**

**`app_time` (or `apptime`) IS included in the MAC calculation.**

### 3. **Exact MAC Calculation Formula** 

#### **For CreateOrder Request:**
```
hmacinput = app_id | app_trans_id | app_user | amount | app_time | embed_data | item
mac = HMAC-SHA256(hmacinput, key1)
```

**Example:**
```
app_id = 554
app_trans_id = "231227_554_1703664997117"
app_user = "user123"
amount = 1500000                           (x100)
app_time = 1703664998490                   (milliseconds, NOT seconds!)
embed_data = "{\"redirecturl\": \"http://localhost:3000\"}"
item = "[{\"itemid\": \"MONTHLY_PRO\", ...}]"

hmacinput = "554|231227_554_1703664997117|user123|1500000|1703664998490|{...}|[...]"
mac = HMAC-SHA256(hmacinput, "8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn")
    = "0336b57f74209f3b944c88b8fc8c878ae518d20b7e88763fb2ff9e14e6c3cac5"
```

#### **For Callback Verification:**
```
hmacinput = app_id | app_transaction_id | zalo_transaction_id | amount | app_user | timestamp
mac = HMAC-SHA256(hmacinput, key2)
```

---

## 📋 CreateOrder API - Full Specification

### **Endpoint**
```
POST https://sandbox.zalopay.com.vn/v001/tpe/createorder
Content-Type: application/x-www-form-urlencoded
```

### **Request Parameters**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `app_id` | number | ✅ | Merchant ID (ZaloPay assigned) | `554` |
| `app_time` | number | ✅ | Timestamp in **milliseconds** (NOT seconds) | `1703664998490` |
| `app_trans_id` | string | ✅ | Unique transaction ID (merchant generated) | `"231227_554_1703664997117"` |
| `app_user` | string | ✅ | User ID | `"user123"` |
| `amount` | number | ✅ | Amount in cents (price × 100) | `1500000` (= 15,000 VND) |
| `description` | string | ✅ | Payment description | `"Pro Subscription"` |
| `item` | string | ✅ | JSON string of items | `"[{\"itemid\":\"...\",...}]"` |
| `embed_data` | string | ✅ | JSON string with metadata | `"{\"redirecturl\":\"...\"}"` |
| `redirect_url` | string | ✅ | Redirect after payment | `"http://localhost:3000/home"` |
| `bank_code` | string | ❌ | Bank code (empty for all methods) | `""` |
| `mac` | string | ✅ | HMAC-SHA256 signature | `"0336b57f..."` |

### **Response**

Success Response:
```json
{
  "return_code": 1,
  "return_message": "Giao dịch thành công",
  "sub_return_code": 1,
  "sub_return_message": "Giao dịch thành công",
  "zp_trans_token": "AC5TYXNLtPgMkO-IBA2_VoBA",
  "order_url": "https://qcgateway.zalopay.vn/openinapp?order=eyJ...",
  "order_token": "AC5TYXNLtPgMkO-IBA2_VoBA",
  "qr_code": "00020101021226520010vn.zalopay..."
}
```

Error Response:
```json
{
  "return_code": -1,
  "return_message": "Unknown error",
  "sub_return_code": -1,
  "sub_return_message": "Unknown error"
}
```

---

## 🔐 Authentication Rules

### **Algorithm:** HmacSHA256

### **Key Information:**
- **Key1** (for creating orders): `8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn` (Sandbox test)
- **Key2** (for verifying callbacks): `uUfsWgfLkRLzq6W2uNXTCxrfxs51auny` (Sandbox test)

### **MAC Calculation Steps:**

1. **Prepare the hmacinput string** - Join fields with `|` (pipe)
2. **Create HMAC-SHA256** - Use the appropriate key
3. **Convert to hex** - Output as hexadecimal string

**JavaScript Example:**
```javascript
const crypto = require('crypto');

// For CreateOrder
const hmacinput = `554|231227_554_1703664997117|user123|1500000|1703664998490|{...}|[...]`;
const mac = crypto
  .createHmac('sha256', '8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn')
  .update(hmacinput)
  .digest('hex');

console.log(mac); // 0336b57f74209f3b944c88b8fc8c878ae518d20b7e88763fb2ff9e14e6c3cac5
```

---

## 📥 Callback Verification

### **Callback Parameters (from ZaloPay)**
```
GET /pro/zalo-callback?
  app_id=554&
  app_transaction_id=231227_554_1703664997117&
  zalo_transaction_id=215012500484627&
  amount=1500000&
  return_code=1&
  return_message=Thành+công&
  app_user=user123&
  timestamp=1703664999&
  mac=XXXX...
```

### **MAC Verification for Callback:**
```javascript
const crypto = require('crypto');

const hmacinput = `${app_id}|${app_transaction_id}|${zalo_transaction_id}|${amount}|${app_user}|${timestamp}`;
const expectedMac = crypto
  .createHmac('sha256', 'uUfsWgfLkRLzq6W2uNXTCxrfxs51auny')  // key2
  .update(hmacinput)
  .digest('hex');

if (expectedMac === receivedMac) {
  // Valid callback
  console.log('✅ Signature matches - Callback is authentic');
} else {
  // Invalid callback
  console.log('❌ Signature mismatch - Reject callback');
}
```

---

## 📝 Return Codes

### **CreateOrder Response Codes:**
| Code | Meaning | Action |
|------|---------|--------|
| `1` | Success - Order created | Redirect user to payment |
| `-1` | Unknown error | Retry or contact support |
| `-2` | Invalid signature (MAC mismatch) | Check keys and MAC calculation |
| `-3` | Insufficient balance | Inform user |
| `-4` | Duplicate transaction | Check for duplicate order ID |

### **Callback Return Codes:**
| Code | Meaning | Grant Pro? |
|------|---------|-----------|
| `1` | Payment successful | ✅ YES |
| Anything else | Payment failed | ❌ NO |

---

## 💡 Critical Implementation Details

### **🚨 Timestamp Format:**
- **Required:** Milliseconds (not seconds!)
- **Example:** `Date.now()` in JavaScript returns milliseconds
- **⚠️ Common Mistake:** Using `Math.floor(Date.now() / 1000)` → This is SECONDS, not milliseconds!

```javascript
// ✅ CORRECT
const apptime = Date.now();  // 1703664998490 (milliseconds)

// ❌ WRONG
const apptime = Math.floor(Date.now() / 1000);  // 1703664998 (seconds)
```

### **Amount Format:**
- **Input:** Price in VND (e.g., 15,000)
- **Send to ZaloPay:** Price × 100 in cents (e.g., 1,500,000)
- **Reason:** ZaloPay API uses cent values for precision

```javascript
// ✅ CORRECT
const amount = 15000 * 100;  // 1500000

// ❌ WRONG
const amount = 15000;  // Missing x100
```

### **Form Encoding:**
- **Method:** `application/x-www-form-urlencoded`
- **Tool:** Use `qs.stringify()` in Node.js or URLSearchParams

```javascript
const qs = require('qs');
const formData = qs.stringify({
  app_id: 554,
  app_time: 1703664998490,
  // ... other parameters
});
```

### **JSON String Fields:**
- **`item`** and **`embed_data`** must be JSON strings (double-encoded)
- **Included in MAC calculation** as strings, not parsed objects

```javascript
// ✅ CORRECT
const item = JSON.stringify([{ itemid: 'PRO', ... }]);  // "[{...}]"
const embeddata = JSON.stringify({ redirecturl: "..." });

// MAC includes the string representation:
const hmacinput = `554|...|...|...|[{...}]`;

// ❌ WRONG
const item = [{ itemid: 'PRO', ... }];  // Object, not string
```

---

## 🔍 Complete Working Example

### **Project Implementation: [zalopay.js](backend/services/zalopay.js)**

```javascript
const crypto = require('crypto');
const axios = require('axios');
const qs = require('qs');

class ZaloPayService {
  async createPaymentUrl(params) {
    const { userId, plan, amount, orderId } = params;

    // Step 1: Prepare parameters
    const apptime = Date.now();  // ✅ Milliseconds
    const amountCents = parseInt(amount) * 100;  // ✅ Amount x 100
    
    const embeddata = JSON.stringify({
      redirecturl: 'http://localhost:3000'
    });
    
    const item = JSON.stringify([{
      itemid: plan === 'monthly' ? 'MONTHLY_PRO' : 'YEARLY_PRO',
      itemname: plan === 'monthly' ? 'Pro Tháng' : 'Pro Năm',
      itemprice: amount,
      itemquantity: 1
    }]);

    // Step 2: Calculate MAC
    // ✅ CORRECT: apptime is INCLUDED in MAC calculation
    const macInput = `${this.appId}|${orderId}|${userId}|${amountCents}|${apptime}|${embeddata}|${item}`;
    const mac = crypto
      .createHmac('sha256', this.key1)
      .update(macInput)
      .digest('hex');

    // Step 3: Prepare request (snake_case)
    const data = {
      app_id: parseInt(this.appId),
      app_time: apptime,              // ✅ Milliseconds
      app_trans_id: orderId,
      app_user: userId,
      amount: amountCents,            // ✅ x 100
      description: 'Payment',
      item: item,
      embed_data: embeddata,
      redirect_url: 'http://localhost:3000',
      mac: mac
    };

    // Step 4: Send request as form-urlencoded
    const formData = qs.stringify(data);
    const response = await axios.post(this.endpoint, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return {
      success: response.data.returncode === 1,
      paymentUrl: response.data.orderurl
    };
  }

  verifyCallback(webhookData) {
    const { mac, ...dataToVerify } = webhookData;

    // ✅ CORRECT: app_time is NOT in callback verification MAC
    const dataStr = `${dataToVerify.app_id}|${dataToVerify.app_transaction_id}|${dataToVerify.zalo_transaction_id}|${dataToVerify.amount}|${dataToVerify.app_user}|${dataToVerify.timestamp}`;

    const calculatedMac = crypto
      .createHmac('sha256', this.key2)  // Use key2 for verification
      .update(dataStr)
      .digest('hex');

    return {
      isValid: calculatedMac === mac,
      returnCode: dataToVerify.return_code,
      success: dataToVerify.return_code === 1
    };
  }
}
```

---

## 🧪 Testing with Sandbox

### **Sandbox Credentials (Test):**
```env
ZALO_APPID=554
ZALO_KEY1=8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn
ZALO_KEY2=uUfsWgfLkRLzq6W2uNXTCxrfxs51auny
ZALO_ENDPOINT=https://sandbox.zalopay.com.vn/v001/tpe/createorder
```

### **Test Flow:**
1. Go to `http://localhost:3000/pro`
2. Select "Pro Tháng" (15,000 VND)
3. Click "Bắt đầu (ZaloPay)"
4. Scan QR code or open in ZaloPay app
5. Complete payment
6. Verify callback received and user marked as Pro

### **Verify MAC Calculation:**
```bash
# Test MAC calculation
node -e "
const crypto = require('crypto');
const key1 = '8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn';
const input = '554|231227_554_1703664997117|user123|1500000|1703664998490|{\"redirecturl\":\"http://localhost:3000\"}|[]';
const mac = crypto.createHmac('sha256', key1).update(input).digest('hex');
console.log('MAC:', mac);
"
```

---

## 📚 Official ZaloPay Documentation Links

- **Main Docs:** https://docs.zalopay.vn/
- **Payment Gateway Guide:** https://docs.zalopay.vn/docs/guides/payment-acceptance/payment-gateway/intro
- **Authentication Rules:** https://docs.zalopay.vn/docs/guides/integration-guide/authentication-rules/intro
- **Sample Code:** https://github.com/zalopay-samples

---

## ⚠️ Common Mistakes & Fixes

| Mistake | Impact | Fix |
|---------|--------|-----|
| Using seconds instead of milliseconds for `app_time` | ❌ Invalid MAC | Use `Date.now()` not `Math.floor(Date.now() / 1000)` |
| Forgetting to multiply amount by 100 | ❌ Incorrect payment amount | Always use `amount * 100` |
| Not including `app_time` in MAC calculation | ❌ Invalid signature | Include in: `appid\|transid\|user\|amount\|apptime\|embed\|item` |
| Using `key2` instead of `key1` for createorder | ❌ Invalid MAC | Use key1 for creation, key2 for callback verification |
| Not converting JSON objects to strings | ❌ MAC mismatch | Use `JSON.stringify()` for item and embed_data |
| Using wrong endpoint | ❌ API call fails | Use v001/tpe/createorder (not v2 API) |
| Sending form-encoded data as JSON | ❌ Request rejected | Use `application/x-www-form-urlencoded` |

---

## 🎓 Summary

### Key Takeaways:
1. **Parameters:** `snake_case` for API requests
2. **Timestamp:** `app_time` in **milliseconds**, **required in MAC**
3. **MAC Formula:** `appid|transid|user|amount|apptime|embeddata|item` → HMAC-SHA256 with key1
4. **Amount:** Multiply by 100 (cents)
5. **Keys:** key1 for creation, key2 for callback verification
6. **Encoding:** Use `application/x-www-form-urlencoded`
7. **Return Code 1:** Payment successful, anything else = failed

