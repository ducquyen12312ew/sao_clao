const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeService {
  constructor() {
    this.stripePK = process.env.STRIPE_PUBLISHABLE_KEY;
    this.stripeSK = process.env.STRIPE_SECRET_KEY;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * Create checkout session
   */
  async createCheckoutSession(params) {
    const { userId, plan, amount } = params;

    try {
      const planInfo = this.getPlanInfo(plan);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: planInfo.name,
                description: `SAOCLAO Pro - ${planInfo.days} days`
              },
              unit_amount: Math.round(amount * 100) // Convert to cents
            },
            quantity: 1
          }
        ],
        mode: 'payment',
        success_url: `${process.env.APP_URL}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL}/pro/cancel`,
        metadata: {
          userId,
          plan,
          amount
        }
      });

      console.log('[Stripe] Checkout session created:', session.id);

      return {
        success: true,
        sessionId: session.id,
        checkoutUrl: session.url
      };
    } catch (error) {
      console.error('[Stripe] Error creating session:', error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          return await this.handleSessionCompleted(event.data.object);
        case 'payment_intent.succeeded':
          return await this.handlePaymentSucceeded(event.data.object);
        default:
          console.log(`[Stripe] Unhandled event type: ${event.type}`);
          return { handled: false };
      }
    } catch (error) {
      console.error('[Stripe] Error handling webhook:', error.message);
      return { handled: false, error: error.message };
    }
  }

  /**
   * Process successful payment
   */
  async handleSessionCompleted(session) {
    const { userId, plan, amount } = session.metadata;

    console.log('[Stripe] Payment completed:', {
      sessionId: session.id,
      userId,
      plan,
      amount
    });

    return {
      handled: true,
      userId,
      plan,
      amount,
      paymentId: session.id
    };
  }

  async handlePaymentSucceeded(paymentIntent) {
    console.log('[Stripe] Payment intent succeeded:', paymentIntent.id);
    return { handled: true, paymentId: paymentIntent.id };
  }

  /**
   * Get plan info
   */
  getPlanInfo(plan) {
    const plans = {
      monthly: {
        name: 'Pro Tháng',
        amount: 5, // $5 USD
        days: 30
      },
      yearly: {
        name: 'Pro Năm',
        amount: 50, // $50 USD
        days: 365
      }
    };
    return plans[plan] || plans.monthly;
  }

  /**
   * Get plan expiry
   */
  getPlanExpiry(plan) {
    const planInfo = this.getPlanInfo(plan);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + planInfo.days);
    return { expiryDays: planInfo.days, expiryDate };
  }

  /**
   * Extend plan expiry
   */
  extendPlanExpiry(currentExpiry, plan) {
    const planInfo = this.getPlanInfo(plan);
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + planInfo.days);
    return newExpiry;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
      return { valid: true, event };
    } catch (error) {
      console.error('[Stripe] Webhook signature verification failed:', error.message);
      return { valid: false, error: error.message };
    }
  }
}

module.exports = new StripeService();
