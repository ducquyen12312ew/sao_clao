/**
 * VNPay Payment Service
 * Xử lý logic tạo request và verify callback từ VNPay
 * Không dùng SDK, tự build theo spec VNPay
 */

const crypto = require('crypto');
const querystring = require('querystring');

class VNPayService {
  constructor() {
    this.tmnCode = process.env.VNP_TMN_CODE;
    this.hashSecret = process.env.VNP_HASH_SECRET;
    this.vnpUrl = process.env.VNP_URL;
    this.returnUrl = process.env.VNP_RETURN_URL;

    if (!this.tmnCode || !this.hashSecret) {
      throw new Error('VNPay configuration missing: VNP_TMN_CODE or VNP_HASH_SECRET');
    }
  }

  /**
   * Tạo payment URL để redirect user sang VNPay
   * @param {Object} params - { userId, plan, amount, orderId, ipAddress, userAgent }
   * @returns {string} - VNPay payment URL
   */
  createPaymentUrl(params) {
    const {
      userId,
      plan,
      amount,
      orderId,
      ipAddress,
      userAgent
    } = params;

    if (!orderId || !amount || !plan) {
      throw new Error('Missing required parameters: orderId, amount, plan');
    }

    // VNPay yêu cầu định dạng thời gian YYYYMMDDHHMMSS
    const createDate = this.formatDate(new Date());

    // Tạo VNPay params object
    const vnpParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: `Thanh toan goi ${plan} - User ${userId}`,
      vnp_OrderType: 'other',
      vnp_Amount: amount * 100, // VNPay yêu cầu x100
      vnp_ReturnUrl: this.returnUrl,
      vnp_IpAddr: ipAddress || '127.0.0.1',
      vnp_CreateDate: createDate
    };

    // Sắp xếp params theo alphabet
    const sortedParams = this.sortObject(vnpParams);

    // Tạo chuỗi dữ liệu để hash
    const signData = querystring.stringify(sortedParams, { encode: false });

    // Tạo HMAC SHA512 signature
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Thêm signature vào params
    const paymentUrl = `${this.vnpUrl}?${signData}&vnp_SecureHash=${signed}`;

    console.log(`[VNPay] Payment URL created for order ${orderId}, amount: ${amount} VND`);

    return paymentUrl;
  }

  /**
   * Verify callback từ VNPay
   * @param {Object} vnpParams - Query params từ vnp_ReturnUrl
   * @returns {Object} - { isValid: boolean, responseCode: string, message: string }
   */
  verifyCallback(vnpParams) {
    // Lấy secure hash từ params
    const secureHash = vnpParams['vnp_SecureHash'];

    if (!secureHash) {
      return {
        isValid: false,
        responseCode: '99',
        message: 'Thiếu vnp_SecureHash'
      };
    }

    // Clone params và xóa secure hash + CurrCode (không tham gia hash)
    const checkParams = { ...vnpParams };
    delete checkParams['vnp_SecureHash'];
    delete checkParams['vnp_SecureHashType'];

    // Sắp xếp params
    const sortedParams = this.sortObject(checkParams);

    // Tạo chuỗi dữ liệu
    const signData = querystring.stringify(sortedParams, { encode: false });

    // Hash lại
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // So sánh signature
    const isValid = signed === secureHash;

    const responseCode = vnpParams['vnp_ResponseCode'];
    const transactionNo = vnpParams['vnp_TransactionNo'];
    const txnRef = vnpParams['vnp_TxnRef'];

    let message = 'Unknown';
    if (responseCode === '00') {
      message = 'Giao dịch thành công';
    } else if (responseCode === '07') {
      message = 'Trừ tiền thành công nhưng không nhận được xác nhận';
    } else if (responseCode === '09') {
      message = 'Giao dịch bị hủy';
    } else {
      message = `Giao dịch thất bại (${responseCode})`;
    }

    console.log(`[VNPay] Verify callback - TxnRef: ${txnRef}, ResponseCode: ${responseCode}, Valid: ${isValid}`);

    return {
      isValid,
      responseCode,
      transactionNo,
      txnRef,
      message
    };
  }

  /**
   * Format date to VNPay format (YYYYMMDDHHMMSS)
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Sort object keys alphabetically
   */
  sortObject(obj) {
    const sorted = {};
    const keys = Object.keys(obj).sort();

    keys.forEach(key => {
      sorted[key] = obj[key];
    });

    return sorted;
  }

  /**
   * Tính toán Pro expiry date dựa trên plan
   * @param {string} plan - 'monthly' or 'yearly'
   * @returns {Object} - { expiryDays: number, expiryDate: Date }
   */
  getPlanExpiry(plan) {
    const now = new Date();
    let expiryDays = 0;
    let expiryDate = new Date(now);

    if (plan === 'monthly') {
      expiryDays = 30;
      expiryDate.setDate(expiryDate.getDate() + 30);
    } else if (plan === 'yearly') {
      expiryDays = 365;
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    }

    return { expiryDays, expiryDate };
  }

  /**
   * Tính toán Pro expiry date khi user có Pro sẵn (cộng dồn)
   * @param {Date} currentExpiry - Ngày hết hạn Pro hiện tại
   * @param {string} plan - 'monthly' or 'yearly'
   * @returns {Date} - Ngày hết hạn mới
   */
  extendPlanExpiry(currentExpiry, plan) {
    let newExpiry = new Date(currentExpiry);

    if (plan === 'monthly') {
      newExpiry.setDate(newExpiry.getDate() + 30);
    } else if (plan === 'yearly') {
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);
    }

    return newExpiry;
  }

  /**
   * Get plan info
   */
  getPlanInfo(plan) {
    const plans = {
      monthly: {
        name: 'Gói tháng',
        amount: 15000,
        days: 30
      },
      yearly: {
        name: 'Gói năm',
        amount: 100000,
        days: 365
      }
    };

    return plans[plan] || null;
  }
}

module.exports = new VNPayService();
