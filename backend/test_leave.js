require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

const emailService = require('./src/services/emailService');

async function testReviewLeave() {
    try {
        const id = 21;
        const leave = await pool.query(
            `SELECT lr.user_id, lr.from_date, lr.to_date, lr.reason
       FROM leave_requests lr WHERE lr.id = $1`,
            [id]
        );

        if (leave.rows.length > 0) {
            console.log("Found leave:", leave.rows[0]);

            const { user_id, from_date, to_date } = leave.rows[0];
            const status = 'REJECTED';
            const emoji = status === "APPROVED" ? "✅" : "❌";
            const notifMessage = `${emoji} Your leave request (${from_date} → ${to_date}) has been ${status} by Admin.`;

            console.log("Sending Notification...");
            await pool.query(
                `INSERT INTO notifications (user_id, message, is_read, created_at)
         VALUES ($1, $2, false, NOW())`,
                [user_id, notifMessage]
            );

            console.log("Sending Email...");
            await emailService.sendLeaveRejectedEmail(user_id, leave.rows[0], "Test Rejection");

            console.log("SUCCESS!");
        } else {
            console.log("Leave request 21 not found.");
        }
    } catch (e) {
        console.error("FAILED:", e);
    } finally {
        pool.end();
    }
}

testReviewLeave();
