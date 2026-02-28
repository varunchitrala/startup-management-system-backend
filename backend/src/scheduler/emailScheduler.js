const cron = require('node-cron');
const pool = require('../config/db');
const emailService = require('../services/emailService');

// 📧 Daily Summary Email to Admin (Every day at 6 PM)
cron.schedule('0 18 * * *', async () => {
  console.log('⏰ Running: Daily summary email to admin');
  try {
    await emailService.sendDailySummaryToAdmin();
  } catch (error) {
    console.error('Daily summary email failed:', error);
  }
}, {
  timezone: "Asia/Kolkata"
});

// 📧 Missing Check-out Reminder (Every day at 9 PM)
cron.schedule('0 21 * * *', async () => {
  console.log('⏰ Running: Missing checkout reminder');
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Find users who checked in but didn't check out
    const result = await pool.query(`
      SELECT user_id
      FROM attendance
      WHERE date = $1
        AND check_in IS NOT NULL
        AND check_out IS NULL
        AND status = 'CHECKED_IN'
    `, [today]);

    for (const row of result.rows) {
      await emailService.sendMissingCheckoutEmail(row.user_id);
    }

    console.log(`✅ Sent ${result.rows.length} missing checkout emails`);
  } catch (error) {
    console.error('Missing checkout email failed:', error);
  }
}, {
  timezone: "Asia/Kolkata"
});

// 📧 Weekly Summary (Every Monday at 9 AM)
cron.schedule('0 9 * * 1', async () => {
  console.log('⏰ Running: Weekly summary email');
  try {
    // Get last week's stats
    const lastWeekStart = new Date();
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date();
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

    // Get admin emails
    const adminResult = await pool.query(
      "SELECT email, name FROM users WHERE role = 'ADMIN'"
    );

    for (const admin of adminResult.rows) {
      // Create and send weekly summary
      // (You can customize this with detailed stats)
      await emailService.sendEmail(
        admin.email,
        '📊 Weekly Attendance Summary',
        `<h2>Weekly Summary</h2><p>Last week's attendance report...</p>`
      );
    }
  } catch (error) {
    console.error('Weekly summary email failed:', error);
  }
}, {
  timezone: "Asia/Kolkata"
});

// 📧 Leave Reminder (Remind employees with low leave balance)
cron.schedule('0 9 1 * *', async () => {
  console.log('⏰ Running: Monthly leave balance reminder');
  try {
    const year = new Date().getFullYear();
    const QUOTA = 18;

    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        COALESCE(SUM((lr.to_date::date - lr.from_date::date) + 1), 0) as used
      FROM users u
      LEFT JOIN leave_requests lr 
        ON lr.user_id = u.id 
        AND lr.status = 'APPROVED'
        AND EXTRACT(YEAR FROM lr.from_date::date) = $1
      GROUP BY u.id, u.name, u.email
      HAVING COALESCE(SUM((lr.to_date::date - lr.from_date::date) + 1), 0) < 5
    `, [year]);

    // Send reminder to employees with less than 5 leaves used
    for (const user of result.rows) {
      const remaining = QUOTA - user.used;
      await emailService.sendEmail(
        user.email,
        '🏖️ Leave Balance Reminder',
        `
          <h2>Take a Break!</h2>
          <p>Hi ${user.name},</p>
          <p>You have <strong>${remaining} days</strong> of leave remaining this year.</p>
          <p>Remember to take time off to recharge! 😊</p>
        `
      );
    }

    console.log(`✅ Sent leave reminders to ${result.rows.length} employees`);
  } catch (error) {
    console.error('Leave reminder email failed:', error);
  }
}, {
  timezone: "Asia/Kolkata"
});

console.log('✅ Email scheduler initialized');

module.exports = {};