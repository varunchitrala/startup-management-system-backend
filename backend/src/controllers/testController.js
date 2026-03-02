const emailService = require('../services/emailService');

const maskEmail = (email) => {
  if (!email || !email.includes("@")) return null;
  const [name, domain] = email.split("@");
  const safeName = name.length <= 2
    ? `${name[0] || "*"}*`
    : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${safeName}@${domain}`;
};

exports.emailHealth = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const host = process.env.EMAIL_HOST || null;
    const port = Number(process.env.EMAIL_PORT || 587);
    const secure = port === 465;
    const user = process.env.EMAIL_USER || null;
    const hasPassword = Boolean(process.env.EMAIL_PASSWORD);
    const envConfigured = Boolean(host && user && hasPassword);

    let smtpVerified = false;
    let verifyError = null;

    if (envConfigured) {
      smtpVerified = await emailService.verifyEmailConnection();
      if (!smtpVerified) {
        verifyError = 'SMTP verify failed. Check server logs for exact provider error.';
      }
    } else {
      verifyError = 'Missing one or more required env vars: EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD';
    }

    res.json({
      envConfigured,
      smtpVerified,
      transport: {
        host,
        port,
        secure,
        user: maskEmail(user),
        hasPassword
      },
      verifyError
    });
  } catch (err) {
    console.error('Email health error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.testEmail = async (req, res) => {
  try {
    // Only allow in development or for admins
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email required' });
    }

    const html = `
      <h1>🎉 Test Email</h1>
      <p>This is a test email from your Leave & Attendance Management System.</p>
      <p>If you received this, your email configuration is working correctly!</p>
      <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
    `;

    const verified = await emailService.verifyEmailConnection();
    if (!verified) {
      return res.status(500).json({
        message: 'SMTP verify failed before send',
        error: 'Check email env config and provider authentication settings'
      });
    }

    const result = await emailService.sendEmail(
      email,
      'Test Email - System Check',
      html
    );

    if (result.success) {
      res.json({ 
        message: 'Test email sent successfully!',
        messageId: result.messageId 
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to send test email',
        error: result.error 
      });
    }

  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ 
      message: 'Server error',
      error: err.message 
    });
  }
};
