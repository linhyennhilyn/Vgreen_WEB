/**
 * Email Service để gửi OTP qua Gmail
 * Email: vgreenhotro@gmail.com
 */

const nodemailer = require('nodemailer');

// Email configuration
const EMAIL_CONFIG = {
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'vgreenhotro@gmail.com',
    pass: 'njrqbfixzhjtikbl' // Gmail App Password (16 ký tự không dấu cách)
  },
  tls: {
    rejectUnauthorized: false
  }
};

/**
 * Tạo transporter để gửi email
 */
const createTransporter = () => {
  return nodemailer.createTransport(EMAIL_CONFIG);
};

/**
 * Template HTML cho email OTP - Clean & Professional
 */
const getOTPEmailTemplate = (adminName, otp) => {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã Xác Thực - VGreen Security</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
      line-height: 1.6;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .email-header {
      background: linear-gradient(135deg, #3CB018 0%, #2D8A1F 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .logo-text {
      color: #ffffff;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 2px;
      margin: 0;
    }
    .security-badge {
      display: inline-block;
      background: rgba(45, 138, 31, 0.6);
      color: #ffffff;
      padding: 8px 24px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.5px;
      margin-top: 12px;
      text-transform: uppercase;
    }
    .email-body {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 16px;
      color: #333333;
      margin-bottom: 24px;
    }
    .greeting strong {
      color: #3CB018;
    }
    .message {
      font-size: 15px;
      color: #666666;
      line-height: 1.8;
      margin-bottom: 32px;
    }
    .otp-section {
      background: #f8f9fa;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 32px 24px;
      text-align: center;
      margin: 32px 0;
    }
    .otp-title {
      font-size: 14px;
      color: #666666;
      font-weight: 600;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .otp-code {
      font-size: 48px;
      font-weight: 700;
      color: #3CB018;
      letter-spacing: 12px;
      font-family: 'Courier New', Courier, monospace;
      margin: 16px 0;
      padding: 16px;
      background: #ffffff;
      border-radius: 8px;
      display: inline-block;
      border: 2px dashed #3CB018;
    }
    .otp-expiry {
      font-size: 13px;
      color: #999999;
      margin-top: 16px;
    }
    .otp-expiry strong {
      color: #333333;
    }
    .security-notice {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 16px 20px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .security-notice-title {
      font-size: 14px;
      font-weight: 700;
      color: #856404;
      margin-bottom: 8px;
    }
    .security-notice-text {
      font-size: 13px;
      color: #856404;
      line-height: 1.6;
    }
    .support-text {
      font-size: 14px;
      color: #666666;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }
    .email-footer {
      background: #f8f9fa;
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer-text {
      font-size: 12px;
      color: #999999;
      margin: 6px 0;
    }
    .footer-brand {
      color: #3CB018;
      font-weight: 600;
    }
    .footer-link {
      color: #3CB018;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .email-body {
        padding: 30px 20px;
      }
      .otp-code {
        font-size: 36px;
        letter-spacing: 8px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <!-- Header -->
    <div class="email-header">
      <h1 class="logo-text">VGREEN</h1>
      <div class="security-badge">Security Team</div>
    </div>

    <!-- Body -->
    <div class="email-body">
      <p class="greeting">Xin chào <strong>${adminName}</strong>,</p>
      
      <p class="message">
        Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản quản trị viên của bạn. 
        Để tiếp tục, vui lòng sử dụng mã xác thực bên dưới:
      </p>

      <!-- OTP Section -->
      <div class="otp-section">
        <div class="otp-title">Mã Xác Thực</div>
        <div class="otp-code">${otp}</div>
        <div class="otp-expiry">Mã này có hiệu lực trong <strong>10 phút</strong></div>
      </div>

      <!-- Security Notice -->
      <div class="security-notice">
        <div class="security-notice-title">Lưu ý bảo mật</div>
        <div class="security-notice-text">
          Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. 
          Tuyệt đối không chia sẻ mã xác thực với bất kỳ ai, kể cả nhân viên VGreen.
        </div>
      </div>

      <p class="support-text">
        Nếu bạn cần hỗ trợ, vui lòng liên hệ đội ngũ bảo mật của chúng tôi qua email: 
        <a href="mailto:vgreenhotro@gmail.com" class="footer-link">vgreenhotro@gmail.com</a>
      </p>
    </div>

    <!-- Footer -->
    <div class="email-footer">
      <p class="footer-text">Email này được gửi từ <span class="footer-brand">VGreen Security</span></p>
      <p class="footer-text">© ${new Date().getFullYear()} VGreen. All rights reserved.</p>
      <p class="footer-text">vgreenhotro@gmail.com</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Gửi OTP qua email
 * @param {string} toEmail - Email người nhận
 * @param {string} adminName - Tên admin
 * @param {string} otp - Mã OTP (6 chữ số)
 * @returns {Promise<Object>} - Result object
 */
const sendOTPEmail = async (toEmail, adminName, otp) => {
  try {
    // console.log('\n📧 === SENDING OTP EMAIL ===');
    // console.log(`   To: ${toEmail}`);
    // console.log(`   Admin: ${adminName}`);
    // console.log(`   OTP: ${otp}`);
    
    const transporter = createTransporter();
    
    // Verify connection
    // console.log('🔌 Verifying email connection...');
    await transporter.verify();
    // console.log('✅ Email connection verified!');
    
    // Email options
    const mailOptions = {
      from: '"VGreen Security" <vgreenhotro@gmail.com>',
      to: toEmail,
      subject: 'Mã xác thực đặt lại mật khẩu - VGreen Security',
      html: getOTPEmailTemplate(adminName, otp),
      text: `Xin chào ${adminName},\n\nMã xác thực của bạn là: ${otp}\n\nMã này có hiệu lực trong 10 phút.\n\nNếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.\n\nTrân trọng,\nVGreen Security Team`,
      priority: 'high',
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };
    
    // Send email
    // console.log('📤 Sending email...');
    const info = await transporter.sendMail(mailOptions);
    
    // console.log('✅ Email sent successfully!');
    // console.log(`   Message ID: ${info.messageId}`);
    // console.log('==========================\n');
    
    return {
      success: true,
      messageId: info.messageId,
      message: 'OTP đã được gửi đến email của bạn'
    };
    
  } catch (error) {
    console.error('❌ Error sending email:', error);
    // console.log('==========================\n');
    
    return {
      success: false,
      error: error.message,
      message: 'Không thể gửi email. Vui lòng thử lại sau.'
    };
  }
};

/**
 * Tạo mã OTP ngẫu nhiên 6 chữ số
 * @returns {string} - OTP code
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = {
  sendOTPEmail,
  generateOTP
};

