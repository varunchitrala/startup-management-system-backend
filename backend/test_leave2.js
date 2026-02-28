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

async function testLeaveUpdate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const id = 21;
        const status = 'REJECTED';
        const req = { user: { id: 1 }, body: { rejection_reason: "Test Error Server" } };

        await client.query(
            `UPDATE leave_requests
       SET status = $1, reviewed_at = NOW(), reviewed_by = $2
       WHERE id = $3`,
            [status, req.user.id, id]
        );

        const leave = await client.query(
            `SELECT lr.user_id, lr.from_date, lr.to_date
       FROM leave_requests lr WHERE lr.id = $1`,
            [id]
        );

        if (leave.rows.length > 0) {
            const { user_id, from_date, to_date } = leave.rows[0];
            const emoji = status === "APPROVED" ? "✅" : "❌";
            const notifMessage = `${emoji} Your leave request (${from_date} → ${to_date}) has been ${status} by Admin.`;

            await client.query(
                `INSERT INTO notifications (user_id, message, is_read, created_at)
         VALUES ($1, $2, false, NOW())`,
                [user_id, notifMessage]
            );

            if (status === "APPROVED") {
                await emailService.sendLeaveApprovedEmail(user_id, leave.rows[0]);
            } else {
                await emailService.sendLeaveRejectedEmail(user_id, leave.rows[0], req.body.rejection_reason);
            }
            console.log("ALL GOOD");
        }
        await client.query('ROLLBACK');
    } catch (err) {
        console.error("FAIL:", err);
        await client.query('ROLLBACK');
    } finally {
        client.release();
        pool.end();
    }
}

testLeaveUpdate();
