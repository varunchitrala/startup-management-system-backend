const emailService = require('../services/emailService');

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