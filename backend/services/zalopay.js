const crypto = require('crypto');
const axios = require('axios');
const qs = require('qs');

class ZaloPayService {
  constructor() {
    this.appId = process.env.ZALO_APPID || '554';
    this.key1 = process.env.ZALO_KEY1;
    this.key2 = process.env.ZALO_KEY2;
    this.endpoint = process.env.ZALO_ENDPOINT || 'https://sandbox.zalopay.com.vn/v001/tpe/createorder';
    this.callbackUrl = process.env.ZALO_CALLBACK_URL || `${process.env.APP_URL || 'http://localhost:3000'}/pro/zalo-callback`;
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Tạo payment URL cho ZaloPay
   * @param {Object} params - {userId, plan, amount, orderId, userAgent, ipAddress}
   * @returns {Promise<{success, returnCode, returnMessage, data, paymentUrl}>}
   */
  async createPaymentUrl(params) {
    const {
      userId,
      plan,
      amount,
      orderId,
      userAgent,
      ipAddress
    } = params;

    // Tạo mac (message authentication code)
    // Format theo ZaloPay docs
    const apptime = Date.now(); // MUST be in milliseconds, not seconds!
    const embeddata = JSON.stringify({
      redirecturl: process.env.APP_URL || 'http://localhost:3000'
    });
    const item = JSON.stringify([{
      itemid: plan === 'monthly' ? 'MONTHLY_PRO' : 'YEARLY_PRO',
      itemname: plan === 'monthly' ? 'Pro Thang' : 'Pro Nam',
      itemprice: amount,
      itemquantity: 1
    }]);

    // Chuyển đổi amount sang cent (x100)
    const amountCents = parseInt(amount) * 100;

    // MAC được tính từ: appid|apptransid|appuser|amount|apptime|embeddata|item
    const macInput = `${this.appId}|${orderId}|${userId}|${amountCents}|${apptime}|${embeddata}|${item}`;
    const mac = crypto
      .createHmac('sha256', this.key1)
      .update(macInput)
      .digest('hex');

    // Data object gửi tới ZaloPay - snake_case keys
    const data = {
      app_id: parseInt(this.appId),
      app_time: apptime,
      app_trans_id: orderId,
      app_user: userId,
      amount: amountCents, // ZaloPay yêu cầu amount x 100
      description: `Payment`,
      item: item,
      embed_data: embeddata,
      redirect_url: process.env.APP_URL || 'http://localhost:3000',
      mac: mac
    };

    // Tạo mac từ data
    // NOTE: mac đã được tính ở trên, chỉ cần thêm vào data

    try {
      console.log('[ZaloPay] Creating payment request:', {
        orderId,
        amount: parseInt(amount),
        amountCents,
        plan,
        userId,
        endpoint: this.endpoint,
        apptime,
        embeddata,
        item: item.substring(0, 100) + '...',
        macInput: `${this.appId}|${orderId}|${userId}|${amountCents}|${apptime}|${embeddata}|${item}`.substring(0, 150) + '...'
      });

      // Convert to form-urlencoded (ZaloPay requires this)
      const formData = qs.stringify(data);
      console.log('[ZaloPay] Form Data (first 500 chars):', formData.substring(0, 500));
      console.log('[ZaloPay] MAC:', mac);
      
      const response = await axios.post(this.endpoint, formData, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log('[ZaloPay] Full Response:', JSON.stringify(response.data, null, 2));

      if (response.data.returncode === 1) {
        // Success
        return {
          success: true,
          returnCode: response.data.returncode,
          returnMessage: response.data.returnmessage,
          data: response.data,
          paymentUrl: response.data.orderurl
        };
      } else {
        return {
          success: false,
          returnCode: response.data.returncode,
          returnMessage: response.data.returnmessage,
          message: response.data.returnmessage || 'Failed to create payment'
        };
      }
    } catch (error) {
      console.error('[ZaloPay] Error creating payment:', {
        message: error.message,
        statusCode: error.response?.status,
        responseData: error.response?.data,
        code: error.code
      });
      return {
        success: false,
        message: error.response?.data?.returnmessage || error.message || 'API request failed'
      };
    }
  }

  /**
   * Verify callback từ ZaloPay
   * @param {Object} webhookData - Dữ liệu từ ZaloPay callback
   * @returns {Object} {isValid, returnCode, returnMessage, amount, zaloTransactionId, appTransactionId}
   */
  verifyCallback(webhookData) {
    try {
      const { mac, ...dataToVerify } = webhookData;

      // Tạo lại signature từ data
      let dataStr = `${dataToVerify.app_id}|${dataToVerify.app_transaction_id}|${dataToVerify.zalo_transaction_id}|${dataToVerify.amount}|${dataToVerify.app_user}|${dataToVerify.timestamp}`;

      const calculatedMac = crypto
        .createHmac('sha256', this.key2)
        .update(dataStr)
        .digest('hex');

      console.log('[ZaloPay] Verify callback:', {
        appTransactionId: dataToVerify.app_transaction_id,
        returnCode: dataToVerify.return_code,
        macMatch: calculatedMac === mac
      });

      if (calculatedMac !== mac) {
        return {
          isValid: false,
          message: 'MAC mismatch - Invalid signature'
        };
      }

      // return_code từ ZaloPay
      // 1 = Success, khác = Failed
      const returnCode = dataToVerify.return_code;

      return {
        isValid: true,
        returnCode: returnCode,
        returnMessage: dataToVerify.return_message,
        amount: dataToVerify.amount / 100, // Convert lại từ x100
        zaloTransactionId: dataToVerify.zalo_transaction_id,
        appTransactionId: dataToVerify.app_transaction_id,
        timestamp: dataToVerify.timestamp,
        success: returnCode === 1
      };
    } catch (error) {
      console.error('[ZaloPay] Error verifying callback:', error);
      return {
        isValid: false,
        message: 'Verification error: ' + error.message
      };
    }
  }

  /**
   * Generate MAC (message authentication code) cho request
   * Không dùng method này nữa - MAC được tính directly trong createPaymentUrl
   */
  generateMac(data) {
    // Deprecated - MAC calculation di chuyển vào createPaymentUrl
    // Giữ lại cho compatibility
    return '';
  }

  /**
   * Lấy thông tin gói Pro
   * @param {String} plan - 'monthly' or 'yearly'
   * @returns {Object} {name, amount, days}
   */
  getPlanInfo(plan) {
    const plans = {
      monthly: {
        name: 'Pro Tháng',
        amount: 15000, // VND
        days: 30
      },
      yearly: {
        name: 'Pro Năm',
        amount: 100000, // VND
        days: 365
      }
    };
    return plans[plan] || plans.monthly;
  }

  /**
   * Tính ngày hết hạn Pro
   * @param {String} plan - 'monthly' or 'yearly'
   * @returns {Object} {expiryDays, expiryDate}
   */
  getPlanExpiry(plan) {
    const planInfo = this.getPlanInfo(plan);
    const expiryDays = planInfo.days;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);
    return { expiryDays, expiryDate };
  }

  /**
   * Cộng dồn thời gian Pro (nếu user đã Pro)
   * @param {Date} currentExpiry - Ngày hết hạn Pro hiện tại
   * @param {String} plan - 'monthly' or 'yearly'
   * @returns {Date} Ngày hết hạn mới
   */
  extendPlanExpiry(currentExpiry, plan) {
    const planInfo = this.getPlanInfo(plan);
    const expiryDays = planInfo.days;
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + expiryDays);
    return newExpiry;
  }
}

module.exports = new ZaloPayService();
