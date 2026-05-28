const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmailVerification = async (toEmail, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/auth/verify-email?token=${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: "請驗證您的新 Email",
    html: `
      <p>您申請變更 Email，請點擊下方連結完成驗證：</p>
      <a href="${verifyUrl}">${verifyUrl}</a>
      <p>連結 1 小時內有效。</p>
    `,
  });
};

module.exports = { sendEmailVerification };
