/**
 * Pro Routes - ZaloPay Payment Integration
 * Xử lý thanh toán gói Pro
 */

const express = require('express');
const { UserCollection, TransactionCollection } = require('../config/db');
const zaloPayService = require('../services/zalopay');

const router = express.Router();

// Middleware check auth
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập'
    });
  }
  next();
};

/**
 * GET /pro
 * Hiển thị trang Pro
 */
router.get('/', (req, res) => {
  res.render('pro', {
    title: 'SAOCLAO Pro - Nâng cấp tài khoản',
    user: req.session.user || null
  });
});

/**
 * POST /pro/pay
 * Tạo order ZaloPay và redirect
 *
 * Body: { plan: 'monthly' | 'yearly' }
 */
router.post('/pay', requireAuth, async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.session.user.id;

    // Validate plan
    if (!['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: 'Plan không hợp lệ'
      });
    }

    // Lấy thông tin gói
    const planInfo = zaloPayService.getPlanInfo(plan);
    if (!planInfo) {
      return res.status(400).json({
        success: false,
        message: 'Gói không tồn tại'
      });
    }

    // Tạo order ID duy nhất (timestamp + random)
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    const orderId = `SAO${userId.slice(-4)}${timestamp}${random}`;

    // Tạo transaction record
    const transaction = await TransactionCollection.create({
      userId,
      transactionCode: orderId,
      plan,
      amount: planInfo.amount,
      currency: 'VND',
      status: 'pending',
      proExpiryDays: planInfo.days,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      gateway: 'zalopay'
    });

    console.log(`[ZaloPay] Order created: ${orderId}, Plan: ${plan}, Amount: ${planInfo.amount} VND`);

    // Tạo ZaloPay payment
    const paymentResult = await zaloPayService.createPaymentUrl({
      userId,
      plan,
      amount: planInfo.amount,
      orderId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    if (!paymentResult.success) {
      await transaction.updateOne({
        status: 'failed',
        errorMessage: paymentResult.message
      });

      return res.status(400).json({
        success: false,
        message: paymentResult.message,
        detail: 'Lỗi khi tạo URL thanh toán ZaloPay'
      });
    }

    console.log(`[ZaloPay] Payment URL created for order ${orderId}`);

    // Redirect sang ZaloPay
    return res.redirect(paymentResult.paymentUrl);
  } catch (error) {
    console.error('[ZaloPay Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo đơn hàng'
    });
  }
});

/**
 * GET /pro/zalo-callback
 * ZaloPay callback - verify và update user
 * Query params: appid, app_trans_id, zalo_trans_id, amount, return_code, return_message, timestamp, mac
 */
router.get('/zalo-callback', async (req, res) => {
  try {
    console.log('[ZaloPay Callback] Query params:', req.query);

    // Verify ZaloPay callback signature
    const verifyResult = zaloPayService.verifyCallback(req.query);

    const appTransactionId = req.query.app_trans_id;
    const returnCode = req.query.return_code;
    const zaloTransactionId = req.query.zalo_trans_id;

    console.log(`[ZaloPay Callback] AppTransId: ${appTransactionId}, ReturnCode: ${returnCode}, Valid: ${verifyResult.isValid}`);

    // Tìm transaction
    const transaction = await TransactionCollection.findOne({
      transactionCode: appTransactionId
    });

    if (!transaction) {
      return res.render('payment-result', {
        success: false,
        message: 'Không tìm thấy đơn hàng',
        detail: `Order: ${appTransactionId}`
      });
    }

    // Kiểm tra signature
    if (!verifyResult.isValid) {
      await transaction.updateOne({
        status: 'failed',
        errorMessage: 'Chữ ký không hợp lệ'
      });

      return res.render('payment-result', {
        success: false,
        message: 'Chữ ký không hợp lệ - đơn hàng bị từ chối',
        detail: 'Có thể do lỗi network hoặc bảo mật'
      });
    }

    // Kiểm tra xem transaction đã được xử lý chưa (tránh F5 spam)
    if (transaction.status !== 'pending') {
      console.log(`[ZaloPay] Transaction ${appTransactionId} already processed (status: ${transaction.status})`);

      return res.render('payment-result', {
        success: transaction.status === 'success',
        message: transaction.status === 'success'
          ? 'Giao dịch đã được xử lý thành công trước đó'
          : `Giao dịch đã có kết quả: ${transaction.status}`,
        detail: transaction.errorMessage || `Return Code: ${returnCode}`
      });
    }

    // Update transaction record
    await transaction.updateOne({
      zaloOrderId: req.query.app_trans_id,
      zaloReturnCode: returnCode,
      zaloTransactionId: zaloTransactionId,
      completedAt: new Date()
    });

    // Xử lý dựa trên return code
    // 1 = Thành công, khác = Thất bại
    if (returnCode === '1' || returnCode === 1) {
      // ✅ Giao dịch thành công
      await transaction.updateOne({ status: 'success' });

      // Update user Pro status
      const user = await UserCollection.findById(transaction.userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Tính toán ngày hết hạn Pro
      let newProExpiry;

      if (user.isPro && user.proExpiredAt && user.proExpiredAt > new Date()) {
        // User đã có Pro sẵn → cộng dồn thời gian
        newProExpiry = zaloPayService.extendPlanExpiry(user.proExpiredAt, transaction.plan);
        console.log(`[Pro] Extended Pro for user ${user.username}: from ${user.proExpiredAt} to ${newProExpiry}`);
      } else {
        // User mới mua Pro → tính từ hôm nay
        const { expiryDate } = zaloPayService.getPlanExpiry(transaction.plan);
        newProExpiry = expiryDate;
        console.log(`[Pro] Activated Pro for user ${user.username}, expires: ${newProExpiry}`);
      }

      // Update user
      user.isPro = true;
      user.proExpiredAt = newProExpiry;
      await user.save();

      // Update session
      req.session.user.isPro = true;

      console.log(`[ZaloPay Success] User ${user.username} paid ${transaction.amount} VND for ${transaction.plan}`);

      return res.render('payment-result', {
        success: true,
        message: 'Nâng cấp Pro thành công! 🎉',
        detail: `Gói ${transaction.plan === 'monthly' ? 'tháng' : 'năm'} - ${transaction.amount.toLocaleString()} VND`,
        planExpiry: newProExpiry.toLocaleDateString('vi-VN')
      });
    } else {
      // ❌ Giao dịch thất bại
      await transaction.updateOne({
        status: 'failed',
        errorMessage: req.query.return_message || 'Unknown error'
      });

      console.log(`[ZaloPay Failed] User ${transaction.userId}, ReturnCode: ${returnCode}`);

      return res.render('payment-result', {
        success: false,
        message: 'Giao dịch thất bại',
        detail: req.query.return_message || 'Vui lòng thử lại',
        returnCode
      });
    }
  } catch (error) {
    console.error('[ZaloPay Callback Error]', error);

    return res.render('payment-result', {
      success: false,
      message: 'Lỗi xử lý giao dịch',
      detail: error.message
    });
  }
});

/**
 * GET /pro/history
 * Xem lịch sử thanh toán
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const transactions = await TransactionCollection.find({
      userId
    }).sort({ createdAt: -1 }).limit(50).lean();

    res.json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('[History Error]', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy lịch sử'
    });
  }
});

module.exports = router;
