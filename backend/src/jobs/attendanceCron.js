const cron = require("node-cron");
const pool = require("../config/db");
const { todayIST } = require("../utils/istTime");

const runAttendanceAutomation = () => {

  // Runs every day at 6:05 PM IST
  cron.schedule("5 18 * * *", async () => {
    console.log("⏳ Running attendance auto processor...");

    try {
      const today = todayIST();
      const holidayRes = await pool.query(
        `SELECT 1
         FROM holidays
         WHERE holiday_date = $1
            OR EXTRACT(DOW FROM $1::date) = 0
         LIMIT 1`,
        [today]
      );
      const fallbackStatus = holidayRes.rows.length > 0 ? "HOLIDAY" : "ABSENT";

      // 1️⃣ Auto force checkout users still checked in
      // Also normalize status to PRESENT and notify affected users.
      const forcedCheckoutResult = await pool.query(`
        WITH forced AS (
          UPDATE attendance
          SET check_out = NOW(),
              force_checked_out = true,
              status = CASE
                WHEN status IN ('CHECKED_IN', 'LATE') THEN 'PRESENT'
                ELSE status
              END
          WHERE date = $1
            AND check_in IS NOT NULL
            AND check_out IS NULL
          RETURNING user_id
        )
        INSERT INTO notifications (user_id, message, is_read, created_at)
        SELECT f.user_id,
               'Auto checkout applied: You were checked out by system at end of day.',
               FALSE,
               NOW()
        FROM forced f
        RETURNING user_id
      `, [today]);

      // 2️⃣ Ensure all users have attendance record
      await pool.query(`
        INSERT INTO attendance (user_id, date, status)
        SELECT u.id, $1, $2
        FROM users u
        WHERE NOT EXISTS (
          SELECT 1 FROM attendance a
          WHERE a.user_id = u.id
            AND a.date = $1
        )
      `, [today, fallbackStatus]);

      console.log(`✅ Attendance automation completed (forced checkouts: ${forcedCheckoutResult.rowCount})`);

    } catch (err) {
      console.error("❌ Cron automation error:", err);
    }
  });

};

module.exports = runAttendanceAutomation;
