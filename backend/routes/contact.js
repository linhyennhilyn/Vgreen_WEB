const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
require('dotenv').config();

// Cấu hình email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'vgreenhotro@gmail.com',
    pass: process.env.EMAIL_PASS || '', // Cần cấu hình App Password từ Gmail
  },
});

// Kiểm tra cấu hình email
if (!process.env.EMAIL_PASS) {
  console.warn('⚠️  EMAIL_PASS chưa được cấu hình trong .env file');
  console.warn('   Vui lòng xem hướng dẫn trong backend/EMAIL_SETUP.md');
}

// Route để gửi email liên hệ
router.post('/send', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // Validate input
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email không hợp lệ',
      });
    }

    // Email gửi đến VGreen
    const mailOptions = {
      from: process.env.EMAIL_USER || 'vgreenhotro@gmail.com',
      to: 'vgreenhotro@gmail.com',
      subject: `[Liên hệ từ khách hàng] ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3CB018;">Yêu cầu hỗ trợ từ khách hàng</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Họ và tên:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Nội dung:</strong></p>
            <div style="background-color: white; padding: 15px; border-radius: 4px; margin-top: 10px;">
              <p style="white-space: pre-wrap; margin: 0;">${message}</p>
            </div>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            Email này được gửi tự động từ form liên hệ trên website VGreen.
          </p>
        </div>
      `,
    };

    // Gửi email
    await transporter.sendMail(mailOptions);

    // Email xác nhận cho khách hàng
    const confirmationMailOptions = {
      from: process.env.EMAIL_USER || 'vgreenhotro@gmail.com',
      to: email,
      subject: '[VGreen] Cảm ơn bạn đã liên hệ với chúng tôi',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #3CB018; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">VGreen</h1>
          </div>
          <div style="padding: 30px 20px;">
            <h2 style="color: #333;">Xin chào ${name},</h2>
            <p>Cảm ơn bạn đã liên hệ với VGreen. Chúng tôi đã nhận được yêu cầu hỗ trợ của bạn.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Nội dung yêu cầu của bạn:</strong></p>
              <p style="white-space: pre-wrap; margin: 10px 0;">${message}</p>
            </div>
            <p>Chúng tôi sẽ phản hồi yêu cầu của bạn trong vòng <strong>24 giờ</strong> làm việc.</p>
            <p>Nếu bạn có bất kỳ câu hỏi nào khác, vui lòng liên hệ:</p>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 10px 0;">📞 <strong>Hotline:</strong> 0123 456 789</li>
              <li style="margin: 10px 0;">📧 <strong>Email:</strong> vgreenhotro@gmail.com</li>
            </ul>
            <p style="margin-top: 30px;">Trân trọng,<br><strong>Đội ngũ VGreen</strong></p>
          </div>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
            <p>Email này được gửi tự động, vui lòng không trả lời email này.</p>
          </div>
        </div>
      `,
    };

    // Gửi email xác nhận cho khách hàng
    await transporter.sendMail(confirmationMailOptions);

    res.json({
      success: true,
      message: 'Email đã được gửi thành công',
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi gửi email. Vui lòng thử lại sau.',
      error: error.message,
    });
  }
});

module.exports = router;

