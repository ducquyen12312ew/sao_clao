/**
 * Pro Routes - Stripe Payment Integration
 * Simple, no-bullshit payment integration
 */

const express = require('express');
const { UserCollection, TransactionCollection } = require('../config/db');
const stripeService = require('../services/stripe');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
 * Show Pro plans page
 */
router.get('/', (req, res) => {
  res.render('pro', {
    title: 'SAOCLAO Pro - Nâng cấp tài khoản',
    user: req.session.user || null,
    stripeKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});

/**
 * POST /pro/pay
 * Create Stripe checkout session
 * Body: { plan: 'monthly' | 'yearly' }
 */
router.post('/pay', requireAuth, async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.session.user.id;

    if (!['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: 'Plan không hợp lệ'
      });
    }

    const planInfo = stripeService.getPlanInfo(plan);

    // Create transaction record
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    const orderId = `SAO${userId.slice(-4)}${timestamp}${random}`;

    const transaction = await TransactionCollection.create({
      userId,
      transactionCode: orderId,
      plan,
      amount: planInfo.amount,
      currency: 'USD',
      status: 'pending',
      gateway: 'stripe',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Create Stripe checkout
    const result = await stripeService.createCheckoutSession({
      userId,
      plan,
      amount: planInfo.amount
    });

    if (!result.success) {
      await transaction.updateOne({
        status: 'failed',
        errorMessage: result.message
      });

      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    // Return checkout URL
    return res.json({
      success: true,
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId
    });
  } catch (error) {
    console.error('[Pro] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo checkout'
    });
  }
});

/**
 * GET /pro/success
 * Handle successful payment
 */
router.get('/success', requireAuth, async (req, res) => {
  try {
    const { session_id } = req.query;
    const userId = req.session.user.id;

    if (!session_id) {
      return res.render('payment-result', {
        success: false,
        message: 'Không tìm thấy session'
      });
    }

    // Get session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    console.log('[Stripe Success] Session:', {
      id: session.id,
      status: session.payment_status,
      userId
    });

    if (session.payment_status !== 'paid') {
      return res.render('payment-result', {
        success: false,
        message: 'Thanh toán chưa hoàn tất'
      });
    }

    // Find transaction
    const { plan } = session.metadata;
    const transaction = await TransactionCollection.findOne({
      userId,
      plan,
      status: 'pending'
    }).sort({ createdAt: -1 });

    if (!transaction) {
      return res.render('payment-result', {
        success: false,
        message: 'Không tìm thấy đơn hàng'
      });
    }

    // Update transaction
    await transaction.updateOne({
      status: 'success',
      stripeSessionId: session_id,
      completedAt: new Date()
    });

    // Update user Pro status
    const user = await UserCollection.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    let newProExpiry;
    if (user.isPro && user.proExpiredAt && user.proExpiredAt > new Date()) {
      newProExpiry = stripeService.extendPlanExpiry(user.proExpiredAt, plan);
      console.log(`[Pro] Extended Pro for user ${user.username}: ${newProExpiry}`);
    } else {
      const { expiryDate } = stripeService.getPlanExpiry(plan);
      newProExpiry = expiryDate;
      console.log(`[Pro] Activated Pro for user ${user.username}: ${newProExpiry}`);
    }

    user.isPro = true;
    user.proExpiredAt = newProExpiry;
    await user.save();

    req.session.user.isPro = true;

    return res.render('payment-result', {
      success: true,
      message: 'Nâng cấp Pro thành công! 🎉',
      detail: `Gói ${plan === 'monthly' ? 'tháng' : 'năm'} - $${transaction.amount}`,
      planExpiry: newProExpiry.toLocaleDateString('vi-VN')
    });
  } catch (error) {
    console.error('[Pro Success] Error:', error);
    return res.render('payment-result', {
      success: false,
      message: 'Lỗi xử lý giao dịch',
      detail: error.message
    });
  }
});

/**
 * GET /pro/cancel
 * Handle cancelled payment
 */
router.get('/cancel', (req, res) => {
  res.render('payment-result', {
    success: false,
    message: 'Bạn đã hủy thanh toán',
    detail: 'Vui lòng thử lại'
  });
});

/**
 * POST /pro/webhook
 * Stripe webhook endpoint
 */
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const rawBody = req.rawBody || req.body;

  try {
    const { valid, event, error } = stripeService.verifySignature(rawBody, sig);

    if (!valid) {
      console.error('[Stripe Webhook] Invalid signature:', error);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Handle webhook
    const session = event.data.object;

    if (event.type === 'checkout.session.completed' && session.payment_status === 'paid') {
      const { userId, plan } = session.metadata;

      console.log('[Stripe Webhook] Payment completed:', {
        sessionId: session.id,
        userId,
        plan
      });

      // Update transaction
      const transaction = await TransactionCollection.findOne({
        userId,
        plan,
        status: 'pending'
      }).sort({ createdAt: -1 });

      if (transaction) {
        await transaction.updateOne({
          status: 'success',
          stripeSessionId: session.id,
          completedAt: new Date()
        });

        // Update user
        const user = await UserCollection.findById(userId);
        if (user) {
          let newProExpiry;
          if (user.isPro && user.proExpiredAt && user.proExpiredAt > new Date()) {
            newProExpiry = stripeService.extendPlanExpiry(user.proExpiredAt, plan);
          } else {
            const { expiryDate } = stripeService.getPlanExpiry(plan);
            newProExpiry = expiryDate;
          }

          user.isPro = true;
          user.proExpiredAt = newProExpiry;
          await user.save();

          console.log(`[Stripe Webhook] User ${user.username} upgraded to Pro`);
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error.message);
    res.status(400).json({ error: 'Webhook error' });
  }
});

/**
 * GET /pro/history
 * View transaction history
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const transactions = await TransactionCollection.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, transactions });
  } catch (error) {
    console.error('[History Error]', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy lịch sử'
    });
  }
});

module.exports = router;
