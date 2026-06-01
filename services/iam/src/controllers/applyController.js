const { 
  sendApplicationCode, 
  sendAcceptanceEmail, 
  sendRejectionEmail 
} = require("../middleware/mail");

// POST /apply/send-code
// 前端產生驗證碼後，呼叫這支 API 讓後端寄信
const sendCode = async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "Email and code are required" });
  }

  try {
    await sendApplicationCode(email, code);
    res.json({ success: true, message: "Verification email sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send email" });
  }
};

// POST /apply/send-approval
// 審核通過：發送帳號與初始密碼 (前端審核後台呼叫)
const sendApproval = async (req, res) => {
  const { email, account, password } = req.body;
  if (!email || !account || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await sendAcceptanceEmail(email, account, password);
    res.json({ success: true, message: "Approval email sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send approval email" });
  }
};

// POST /apply/send-rejection
// 審核不通過：發送拒絕理由 (前端審核後台呼叫)
const sendRejection = async (req, res) => {
  const { email, reason } = req.body;
  if (!email || !reason) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await sendRejectionEmail(email, reason);
    res.json({ success: true, message: "Rejection email sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send rejection email" });
  }
};

module.exports = {
  sendCode,
  sendApproval,
  sendRejection
};