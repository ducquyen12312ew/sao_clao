# 📋 ZaloPay Quick Reference

## Sandbox Credentials (Already Configured!)
```env
ZALO_APPID=554
ZALO_KEY1=8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn
ZALO_KEY2=uUfsWgfLkRLzq6W2uNXTCxrfxs51auny
ZALO_ENDPOINT=https://sandbox.zalopay.com.vn/v001/tpe/createorder
ZALO_CALLBACK_URL=http://localhost:3000/pro/zalo-callback
APP_URL=http://localhost:3000
```

## Endpoints

### User Facing
| Method | Path | Description |
|--------|------|-------------|
| GET | `/pro` | Show Pro plans |
| POST | `/pro/pay` | Create ZaloPay payment |
| GET | `/pro/zalo-callback` | ZaloPay callback (server-to-server) |
| GET | `/pro/history` | View transaction history |

### Return Codes (ZaloPay)
| Code | Meaning | Pro Status |
|------|---------|-----------|
| `1` | Success | ✅ Grant |
| `-1` | Unknown error | ❌ No grant |
| `-2` | Invalid signature | ❌ No grant |
| `-3` | Insufficient balance | ❌ No grant |
| `-4` | Duplicate transaction | ❌ No grant |

## Key Files
```
backend/
  services/zalopay.js    ← ZaloPayService class
  routes/pro.js          ← Payment routes
  config/db.js           ← TransactionSchema

frontend/
  views/pro.ejs          ← Plan selection
  views/payment-result.ejs ← Payment status

.env                     ← ZaloPay config
```

## Payment Flow
```
1. User selects plan at /pro
2. POST /pro/pay
   - Validate plan
   - Create transaction (pending)
   - Call ZaloPay API
   - Redirect to ZaloPay
3. User pays at ZaloPay
4. ZaloPay callback to /pro/zalo-callback
   - Verify MAC signature
   - Check return code
   - If success: Set user.isPro = true, proExpiredAt
   - Render payment-result.ejs
5. Auto redirect to /home (5 seconds)
```

## MAC Verification
```javascript
// For creating payment
dataStr = `${appId}|${appTransactionId}|${userId}|${amount}|${embedData}|${item}`
mac = HMAC-SHA256(dataStr, key1).hex()

// For verifying callback
dataStr = `${appId}|${appTransactionId}|${zaloTransactionId}|${amount}|${appUser}|${timestamp}`
mac = HMAC-SHA256(dataStr, key2).hex()
```

## Payment Plans
- **Monthly**: 15,000 VND → 30 days Pro
- **Yearly**: 100,000 VND → 365 days Pro

## Database Fields
```javascript
{
  transactionCode,      // Order ID (SAO...)
  plan,                 // monthly|yearly
  amount,               // VND
  status,               // pending|success|failed
  gateway: 'zalopay',
  zaloOrderId,          // From ZaloPay
  zaloReturnCode,       // 1=success, -1,-2, etc=fail
  zaloTransactionId,    // From ZaloPay
  proExpiredAt,         // Pro expiry date
}
```

## Common Errors
| Error | Solution |
|-------|----------|
| "Invalid signature" | Check ZALO_KEY1 and ZALO_KEY2 |
| "Callback not received" | Check ZALO_CALLBACK_URL correct |
| "User not Pro" | Check /zalo-callback success handling |
| "F5 duplicate grant" | Check `transaction.status !== 'pending'` |
| "Amount mismatch" | Verify amount x 100 in request |

## Testing Commands
```bash
# Create payment (local test)
curl -X POST http://localhost:3000/pro/pay \
  -d "plan=monthly" \
  -H "Content-Type: application/x-www-form-urlencoded"

# Check transactions
db.transactions.find({ gateway: 'zalopay' })

# Check Pro users
db.users.find({ isPro: true }).count()

# Check pending transactions
db.transactions.find({ status: 'pending' })
```

## Sandbox Testing
1. Go to: http://localhost:3000/pro
2. Select: Monthly (15,000 VND)
3. Click: "Bắt đầu (ZaloPay)"
4. Scan QR code in sandbox
5. Complete payment
6. ✅ Check user.isPro in database

## URLs
- **ZaloPay**: https://zalopay.com/
- **Developer**: https://developer.zalopay.vn/
- **Sandbox API**: https://sandbox.zalopay.com.vn/api/v2/create
- **Production API**: https://api.zalopay.com.vn/api/v2/create

## ZaloPayService Methods
```javascript
createPaymentUrl(params)    // → {success, paymentUrl, data}
verifyCallback(callbackData) // → {isValid, returnCode, amount, ...}
getPlanInfo(plan)           // → {name, amount, days}
getPlanExpiry(plan)         // → {expiryDays, expiryDate}
extendPlanExpiry(current, plan) // → newExpiry (Date)
generateMac(data)           // → mac hex string
```

## F5 Protection
- Check `transaction.status !== 'pending'` before processing
- Update status immediately to prevent double-processing
- Return cached result on F5 refresh

## Pro Duration
- Monthly: 30 days from today (or extend from current expiry)
- Yearly: 365 days from today (or extend from current expiry)
- Extension: If user already Pro, add days to current expiry

## Production Setup
1. Register at: https://developer.zalopay.vn/
2. Get production AppID, Key1, Key2
3. Update .env with production credentials
4. Change ZALO_ENDPOINT to production URL
5. Update ZALO_CALLBACK_URL to your domain
6. Enable HTTPS
7. Test once before deploying

---
**Status**: ✅ Complete & ready to test

**Sandbox Credentials are already in .env** - just run the app!
