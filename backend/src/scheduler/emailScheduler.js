const cron = require('node-cron');
const pool = require('../config/db');
const emailService = require('../services/emailService');
const { todayIST, nowIST, getWeekRangeIST } = require('../utils/istTime');

function getWeekStartIST() {
  return getWeekRangeIST().weekStart;
}

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
    const today = todayIST();

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

// 🔔 Manual checkout reminder (5:50 PM IST, Mon-Sat) for users still checked in
cron.schedule('50 17 * * 1-6', async () => {
  console.log('⏰ Running: Manual checkout reminder notifications');
  try {
    const today = todayIST();

    const result = await pool.query(`
      INSERT INTO notifications (user_id, message, is_read, created_at)
      SELECT a.user_id,
             'Reminder: Please do manual checkout now.',
             FALSE,
             NOW()
      FROM attendance a
      WHERE a.date = $1
        AND a.check_in IS NOT NULL
        AND a.check_out IS NULL
        AND a.status = 'CHECKED_IN'
        AND NOT EXISTS (
          SELECT 1
          FROM notifications n
          WHERE n.user_id = a.user_id
            AND n.message = 'Reminder: Please do manual checkout now.'
            AND n.created_at >= NOW() - INTERVAL '4 hours'
        )
      RETURNING user_id
    `, [today]);

    console.log(`✅ Manual checkout reminders sent: ${result.rowCount}`);
  } catch (error) {
    console.error('Manual checkout reminder notifications failed:', error);
  }
}, {
  timezone: "Asia/Kolkata"
});

// 🔔 Daily report reminder (4:30 PM and 5:30 PM IST)
cron.schedule('30 16,17 * * 1-6', async () => {
  console.log('⏰ Running: Daily report reminder notifications');
  try {
    const today = todayIST();

    await pool.query(`
      INSERT INTO notifications (user_id, message, is_read, created_at)
      SELECT a.user_id,
             'Reminder: Submit today''s daily work report before checkout.',
             FALSE,
             NOW()
      FROM attendance a
      LEFT JOIN work_reports wr
        ON wr.user_id = a.user_id
       AND wr.report_type = 'DAILY'
       AND wr.report_date = $1
      WHERE a.date = $1
        AND a.status = 'CHECKED_IN'
        AND a.check_in IS NOT NULL
        AND a.check_out IS NULL
        AND wr.id IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM notifications n
          WHERE n.user_id = a.user_id
            AND n.message = 'Reminder: Submit today''s daily work report before checkout.'
            AND n.created_at >= NOW() - INTERVAL '90 minutes'
        )
    `, [today]);

    // Saturday-only weekly reminder for LEAD and MEMBER
    const isSaturdayIST = nowIST().getUTCDay() === 6;

    if (isSaturdayIST) {
      const weekStart = getWeekStartIST();

      await pool.query(`
        INSERT INTO notifications (user_id, message, is_read, created_at)
        SELECT a.user_id,
               'Reminder: Saturday checkout requires weekly report submission.',
               FALSE,
               NOW()
        FROM attendance a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN work_reports wr
          ON wr.user_id = a.user_id
         AND wr.report_type = 'WEEKLY'
         AND wr.week_start = $2
        WHERE a.date = $1
          AND a.status = 'CHECKED_IN'
          AND a.check_in IS NOT NULL
          AND a.check_out IS NULL
          AND u.role IN ('LEAD', 'MEMBER')
          AND wr.id IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM notifications n
            WHERE n.user_id = a.user_id
              AND n.message = 'Reminder: Saturday checkout requires weekly report submission.'
              AND n.created_at >= NOW() - INTERVAL '90 minutes'
          )
      `, [today, weekStart]);
    }

    console.log('✅ Daily report reminder notifications completed');
  } catch (error) {
    console.error('Daily report reminder notifications failed:', error);
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

// ⏰ AUTO-CHECKOUT at 7:00 PM IST — with penalty system
cron.schedule('0 19 * * *', async () => {
  console.log('⏰ Running: Auto-checkout with penalty system (7 PM)');
  try {
    const today = todayIST();
    const currentMonth = today.slice(0, 7); // YYYY-MM

    const checkedIn = await pool.query(`
      SELECT a.user_id, a.id AS aid, u.name
      FROM attendance a
      JOIN users u ON u.id = a.user_id
      WHERE a.date = $1 AND a.status = 'CHECKED_IN'
        AND a.check_in IS NOT NULL AND a.check_out IS NULL
    `, [today]);

    for (const row of checkedIn.rows) {
      // Check if daily report was submitted
      const rpt = await pool.query(
        `SELECT 1 FROM work_reports WHERE user_id=$1 AND report_type='DAILY' AND report_date=$2 LIMIT 1`,
        [row.user_id, today]
      );

      const hasReport = rpt.rows.length > 0;

      if (hasReport) {
        // Had report but forgot to click checkout — mark as PRESENT (minor offense)
        await pool.query(
          `UPDATE attendance SET check_out = NOW(), status = 'PRESENT' WHERE id = $1`,
          [row.aid]
        );
        await pool.query(
          `INSERT INTO notifications (user_id, message, is_read, created_at) VALUES ($1, $2, false, NOW())`,
          [row.user_id, '⚠️ You forgot to checkout today but your work report was submitted. Auto-checked out.']
        );
      } else {
        // No report AND no checkout — PENALTY
        await pool.query(
          `UPDATE attendance SET check_out = NOW(), status = 'MISSED_CHECKOUT' WHERE id = $1`,
          [row.aid]
        );

        // Create missed checkout record
        await pool.query(
          `INSERT INTO missed_checkouts (user_id, date, auto_checkout_at, status)
           VALUES ($1, $2, NOW(), 'PENDING')
           ON CONFLICT (user_id, date) DO NOTHING`,
          [row.user_id, today]
        );

        // Count missed checkouts this month for progressive penalty
        const countRes = await pool.query(
          `SELECT COUNT(*)::int AS total FROM missed_checkouts
           WHERE user_id = $1 AND TO_CHAR(date, 'YYYY-MM') = $2`,
          [row.user_id, currentMonth]
        );
        const missedCount = countRes.rows[0].total;

        let penaltyMsg = '';

        if (missedCount <= 5) {
          // Warning only
          penaltyMsg = `⚠️ WARNING (${missedCount}/5): You missed checkout and didn't submit your work report today. Your check-in is BLOCKED until you submit the missed checkout report. After 5 warnings, leave will be deducted.`;
        } else {
          // Deduct 1 day leave for each offense after 5 warnings
          penaltyMsg = `🚨 PENALTY: Missed checkout #${missedCount} this month (exceeded 5 warnings). 1 day leave has been deducted. Check-in is BLOCKED until you submit the report.`;

          // Deduct from leave balance
          const year = nowIST().getUTCFullYear();
          await pool.query(
            `UPDATE leave_balances
             SET used = used + 1,
                 remaining = GREATEST(remaining - 1, 0)
             WHERE user_id = $1 AND year = $2`,
            [row.user_id, year]
          );

          // Notify admin about penalty
          const adminRes = await pool.query(`SELECT id FROM users WHERE role = 'ADMIN'`);
          for (const admin of adminRes.rows) {
            await pool.query(
              `INSERT INTO notifications (user_id, message, is_read, created_at) VALUES ($1, $2, false, NOW())`,
              [admin.id, `🚨 ${row.name} has ${missedCount} missed checkouts this month. 1 day leave deducted as penalty.`]
            );
          }
        }

        // Notify the user
        await pool.query(
          `INSERT INTO notifications (user_id, message, is_read, created_at) VALUES ($1, $2, false, NOW())`,
          [row.user_id, penaltyMsg]
        );
      }
    }

    console.log(`✅ Auto-checkout with penalties done: ${checkedIn.rows.length} users processed`);
  } catch (error) {
    console.error('Auto-checkout with penalties failed:', error);
  }
}, { timezone: "Asia/Kolkata" });

module.exports = {};
