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

// --- 新增的功能 ---

// 1. 發送申請驗證碼 (由前端產生並傳給後端)
const sendApplicationCode = async (toEmail, code) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: "商家入駐申請 - 信箱驗證碼",
    html: `
      <h2>您的驗證碼為：<strong>${code}</strong></h2>
      <p>請將此驗證碼輸入至申請頁面中以確認您的信箱可用。</p>
    `,
  });
};

// 2. 發送審核通過信
const sendAcceptanceEmail = async (toEmail, account, password) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: "商家入駐申請 - 審核通過",
    html: `
      <h2>恭喜您，您的商家入駐申請已通過審核！</h2>
      <p>以下是您的登入資訊：</p>
      <ul>
        <li><strong>帳號：</strong>${account}</li>
        <li><strong>初始密碼：</strong>${password}</li>
      </ul>
      <p>請盡快登入系統並更改您的密碼。</p>
    `,
  });
};

// 3. 發送審核拒絕信
const sendRejectionEmail = async (toEmail, reason) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: "商家入駐申請 - 審核未通過",
    html: `
      <h2>很遺憾，您的商家入駐申請未通過審核。</h2>
      <p><strong>未通過原因：</strong></p>
      <p>${reason}</p>
      <p>若有任何疑問，歡迎聯繫客服。</p>
    `,
  });
};

module.exports = { 
  sendEmailVerification, 
  sendApplicationCode, 
  sendAcceptanceEmail, 
  sendRejectionEmail 
};
