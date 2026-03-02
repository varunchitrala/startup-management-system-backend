const nodemailer = require('nodemailer');
const dns = require('dns');
const pool = require('../config/db');

// Render environments can fail outbound IPv6 to Gmail SMTP (ENETUNREACH).
// Force DNS resolution preference to IPv4 for SMTP connections.
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const emailHost = process.env.EMAIL_HOST;
const emailPort = Number(process.env.EMAIL_PORT || 587);
const emailUser = process.env.EMAIL_USER;
const emailPassword = process.env.EMAIL_PASSWORD;
const emailSecure = emailPort === 465;
const isGmailHost = (emailHost || "").toLowerCase() === "smtp.gmail.com";

if (!emailHost || !emailUser || !emailPassword) {
  console.error("Email config missing. Required: EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD");
}

const createTransporter = (port) => {
  const secure = port === 465;
  return nodemailer.createTransport({
    host: emailHost,
    port,
    secure,
    requireTLS: !secure,
    // Prefer IPv4 in cloud runtimes where IPv6 SMTP routing can timeout.
    family: 4,
    connectionTimeout: 25000,
    greetingTimeout: 25000,
    socketTimeout: 30000,
    auth: {
      user: emailUser,
      pass: emailPassword
    },
    tls: {
      minVersion: "TLSv1.2"
    }
  });
};

// Primary transport from env port; fallback is only used when needed.
const transporter = createTransporter(emailPort);

const shouldTryGmailFallback = (error, port) =>
  isGmailHost && Number(port) === 587 && (error?.code === "ETIMEDOUT" || error?.command === "CONN");

const normalizeVerifyError = (error) => ({
  ok: false,
  code: error?.code || null,
  message: error?.message || "Unknown verify error",
  response: error?.response || null,
  command: error?.command || null
});

const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log(`Email service ready (${emailHost}:${emailPort}, secure=${emailSecure})`);
    return { ok: true, host: emailHost, port: emailPort, secure: emailSecure };
  } catch (error) {
    console.error("Email service verify failed:", error?.code || error?.name, error?.message || error);

    if (shouldTryGmailFallback(error, emailPort)) {
      try {
        const fallback = createTransporter(465);
        await fallback.verify();
        console.log("Email fallback verify succeeded (smtp.gmail.com:465, secure=true)");
        return { ok: true, host: emailHost, port: 465, secure: true, fallbackUsed: true };
      } catch (fallbackError) {
        console.error("Email fallback verify failed:", fallbackError?.code || fallbackError?.name, fallbackError?.message || fallbackError);
        return normalizeVerifyError(fallbackError);
      }
    }

    return normalizeVerifyError(error);
  }
};

// Base email sender
const sendEmail = async (to, subject, html) => {
  try {
    if (!emailHost || !emailUser || !emailPassword) {
      return { success: false, error: "Email configuration missing in environment variables" };
    }

    const info = await transporter.sendMail({
      from: `"${process.env.COMPANY_NAME || 'Company'}" <${emailUser}>`,
      to,
      subject,
      html
    });

    console.log(`Email sent to ${to}: ${info.messageId} | ${info.response || "no-response"}`);
    return { success: true, messageId: info.messageId, response: info.response, port: emailPort };
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error?.code || error?.name, error?.message || error);

    if (shouldTryGmailFallback(error, emailPort)) {
      try {
        const fallback = createTransporter(465);
        const info = await fallback.sendMail({
          from: `"${process.env.COMPANY_NAME || 'Company'}" <${emailUser}>`,
          to,
          subject,
          html
        });
        console.log(`Email sent via fallback 465 to ${to}: ${info.messageId} | ${info.response || "no-response"}`);
        return { success: true, messageId: info.messageId, response: info.response, port: 465, fallbackUsed: true };
      } catch (fallbackError) {
        console.error(`Fallback send failed to ${to}:`, fallbackError?.code || fallbackError?.name, fallbackError?.message || fallbackError);
        return { success: false, error: fallbackError?.message || "Email fallback failed" };
      }
    }

    return { success: false, error: error.message };
  }
};
// ==================== LEAVE NOTIFICATIONS ====================

const sendLeaveAppliedEmail = async (userId) => {
  try {
    const userResult = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) return;
    
    const user = userResult.rows[0];
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0052cc; color: white; padding: 20px; text-align: center; }
          .content { background: #f4f5f7; padding: 30px; }
          .button { background: #0052cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Leave Request Received</h1>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>Your leave request has been successfully submitted and is pending approval.</p>
            <p>You will receive an email notification once your request is reviewed.</p>
            <a href="${process.env.FRONTEND_URL}/member/dashboard.html" class="button">View Dashboard</a>
          </div>
          <div class="footer">
            <p>This is an automated message from ${process.env.COMPANY_NAME}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(user.email, 'Leave Request Submitted', html);
  } catch (error) {
    console.error('Error sending leave applied email:', error);
  }
};

const sendLeaveApprovedEmail = async (userId, leaveDetails) => {
  try {
    const userResult = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) return;
    
    const user = userResult.rows[0];
    const fromDate = new Date(leaveDetails.from_date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    const toDate = new Date(leaveDetails.to_date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #00875a; color: white; padding: 20px; text-align: center; }
          .content { background: #f4f5f7; padding: 30px; }
          .info-box { background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #00875a; }
          .button { background: #00875a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Leave Approved</h1>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>Great news! Your leave request has been <strong>approved</strong>.</p>
            
            <div class="info-box">
              <p><strong>📅 From:</strong> ${fromDate}</p>
              <p><strong>📅 To:</strong> ${toDate}</p>
              <p><strong>📝 Reason:</strong> ${leaveDetails.reason}</p>
            </div>
            
            <p>Enjoy your time off! 🎉</p>
            <a href="${process.env.FRONTEND_URL}/member/dashboard.html" class="button">View Dashboard</a>
          </div>
          <div class="footer">
            <p>This is an automated message from ${process.env.COMPANY_NAME}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(user.email, '✅ Leave Request Approved', html);
  } catch (error) {
    console.error('Error sending leave approved email:', error);
  }
};

const sendLeaveRejectedEmail = async (userId, leaveDetails, rejectionReason) => {
  try {
    const userResult = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) return;
    
    const user = userResult.rows[0];
    const fromDate = new Date(leaveDetails.from_date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    const toDate = new Date(leaveDetails.to_date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #de350b; color: white; padding: 20px; text-align: center; }
          .content { background: #f4f5f7; padding: 30px; }
          .info-box { background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #de350b; }
          .button { background: #0052cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Leave Not Approved</h1>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>We regret to inform you that your leave request has been <strong>rejected</strong>.</p>
            
            <div class="info-box">
              <p><strong>📅 From:</strong> ${fromDate}</p>
              <p><strong>📅 To:</strong> ${toDate}</p>
              <p><strong>📝 Reason:</strong> ${leaveDetails.reason}</p>
              ${rejectionReason ? `<p><strong>⚠️ Rejection Reason:</strong> ${rejectionReason}</p>` : ''}
            </div>
            
            <p>Please contact your manager or HR for more details.</p>
            <a href="${process.env.FRONTEND_URL}/member/dashboard.html" class="button">View Dashboard</a>
          </div>
          <div class="footer">
            <p>This is an automated message from ${process.env.COMPANY_NAME}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(user.email, '❌ Leave Request Rejected', html);
  } catch (error) {
    console.error('Error sending leave rejected email:', error);
  }
};

// ==================== ATTENDANCE NOTIFICATIONS ====================

const sendLateArrivalEmail = async (userId, checkInTime) => {
  try {
    const userResult = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) return;
    
    const user = userResult.rows[0];
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ffab00; color: white; padding: 20px; text-align: center; }
          .content { background: #f4f5f7; padding: 30px; }
          .info-box { background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #ffab00; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Late Arrival Notice</h1>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>This is to inform you that you arrived late today.</p>
            
            <div class="info-box">
              <p><strong>Check-in Time:</strong> ${checkInTime}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
            </div>
            
            <p>Please ensure timely attendance. If you have any concerns, please contact HR.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from ${process.env.COMPANY_NAME}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(user.email, '⏰ Late Arrival Notice', html);
  } catch (error) {
    console.error('Error sending late arrival email:', error);
  }
};

const sendMissingCheckoutEmail = async (userId) => {
  try {
    const userResult = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) return;
    
    const user = userResult.rows[0];
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #de350b; color: white; padding: 20px; text-align: center; }
          .content { background: #f4f5f7; padding: 30px; }
          .info-box { background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #de350b; }
          .button { background: #0052cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Missing Check-out</h1>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>You forgot to check out yesterday!</p>
            
            <div class="info-box">
              <p><strong>Date:</strong> ${new Date(Date.now() - 86400000).toLocaleDateString('en-IN')}</p>
              <p>Please submit a regularization request or contact your manager.</p>
            </div>
            
            <a href="${process.env.FRONTEND_URL}/member/dashboard.html" class="button">View Dashboard</a>
          </div>
          <div class="footer">
            <p>This is an automated message from ${process.env.COMPANY_NAME}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(user.email, '⚠️ Missing Check-out - Action Required', html);
  } catch (error) {
    console.error('Error sending missing checkout email:', error);
  }
};

// ==================== ADMIN NOTIFICATIONS ====================

const sendDailySummaryToAdmin = async () => {
  try {
    // Get admin emails
    const adminResult = await pool.query(
      "SELECT email, name FROM users WHERE role = 'ADMIN'"
    );
    
    if (adminResult.rows.length === 0) return;
    
    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'PRESENT') as present,
        COUNT(*) FILTER (WHERE status = 'CHECKED_IN') as checked_in,
        COUNT(*) FILTER (WHERE status = 'ABSENT') as absent,
        COUNT(*) FILTER (WHERE status = 'LATE') as late,
        COUNT(*) FILTER (WHERE status = 'ON_LEAVE') as on_leave
      FROM attendance
      WHERE date = $1
    `, [today]);
    
    const stats = statsResult.rows[0];
    
    // Get pending leave requests
    const leaveResult = await pool.query(`
      SELECT COUNT(*) as pending_leaves
      FROM leave_requests
      WHERE status = 'PENDING'
    `);
    
    const pendingLeaves = leaveResult.rows[0].pending_leaves;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #172b4d; color: white; padding: 20px; text-align: center; }
          .content { background: #f4f5f7; padding: 30px; }
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
          .stat-card { background: white; padding: 20px; text-align: center; border-radius: 8px; }
          .stat-number { font-size: 32px; font-weight: bold; color: #0052cc; }
          .stat-label { color: #666; font-size: 14px; }
          .alert { background: #fff4e5; border-left: 4px solid #ffab00; padding: 15px; margin: 20px 0; }
          .button { background: #0052cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Daily Attendance Summary</h1>
            <p>${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div class="content">
            <h2>Today's Statistics</h2>
            
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-number" style="color: #00875a;">${stats.present || 0}</div>
                <div class="stat-label">Present</div>
              </div>
              <div class="stat-card">
                <div class="stat-number" style="color: #0052cc;">${stats.checked_in || 0}</div>
                <div class="stat-label">Checked In</div>
              </div>
              <div class="stat-card">
                <div class="stat-number" style="color: #de350b;">${stats.absent || 0}</div>
                <div class="stat-label">Absent</div>
              </div>
              <div class="stat-card">
                <div class="stat-number" style="color: #ffab00;">${stats.late || 0}</div>
                <div class="stat-label">Late</div>
              </div>
              <div class="stat-card">
                <div class="stat-number" style="color: #6554c0;">${stats.on_leave || 0}</div>
                <div class="stat-label">On Leave</div>
              </div>
              <div class="stat-card">
                <div class="stat-number" style="color: #ff8b00;">${pendingLeaves}</div>
                <div class="stat-label">Pending Leaves</div>
              </div>
            </div>
            
            ${pendingLeaves > 0 ? `
              <div class="alert">
                <strong>⚠️ Action Required:</strong> You have ${pendingLeaves} pending leave request(s) awaiting approval.
              </div>
            ` : ''}
            
            <a href="${process.env.FRONTEND_URL}/admin/dashboard.html" class="button">View Full Dashboard</a>
          </div>
          <div class="footer">
            <p>This is an automated daily summary from ${process.env.COMPANY_NAME}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Send to all admins
    for (const admin of adminResult.rows) {
      await sendEmail(admin.email, `📊 Daily Summary - ${new Date().toLocaleDateString('en-IN')}`, html);
    }
  } catch (error) {
    console.error('Error sending daily summary:', error);
  }
};

// ==================== WELCOME EMAIL ====================

const sendWelcomeEmail = async (userId, temporaryPassword) => {
  try {
    const userResult = await pool.query(
      'SELECT name, email, user_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) return;
    
    const user = userResult.rows[0];
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0052cc; color: white; padding: 20px; text-align: center; }
          .content { background: #f4f5f7; padding: 30px; }
          .credentials { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #0052cc; }
          .button { background: #0052cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .warning { background: #fff4e5; padding: 15px; margin: 20px 0; border-left: 4px solid #ffab00; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to ${process.env.COMPANY_NAME}!</h1>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>Welcome aboard! Your account has been created successfully.</p>
            
            <div class="credentials">
              <h3>Your Login Credentials:</h3>
              <p><strong>User ID:</strong> ${user.user_id}</p>
              <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
              <p><strong>Login URL:</strong> <a href="${process.env.FRONTEND_URL}">${process.env.FRONTEND_URL}</a></p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> Please change your password after first login for security.
            </div>
            
            <a href="${process.env.FRONTEND_URL}" class="button">Login Now</a>
            
            <p>If you have any questions, please contact HR or IT support.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from ${process.env.COMPANY_NAME}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(user.email, `Welcome to ${process.env.COMPANY_NAME}!`, html);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};

// Export all functions
module.exports = {
  sendEmail,
  verifyEmailConnection,
  sendLeaveAppliedEmail,
  sendLeaveApprovedEmail,
  sendLeaveRejectedEmail,
  sendLateArrivalEmail,
  sendMissingCheckoutEmail,
  sendDailySummaryToAdmin,
  sendWelcomeEmail
};
