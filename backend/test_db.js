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

async function run() {
    try {
        const res = await pool.query(`
      SELECT
        u.id,
        u.user_id,
        u.name,
        u.email,
        u.role,
        u.shift_id,
        CASE
          WHEN u.role = 'TEAM_LEAD' AND EXISTS (
            SELECT 1 FROM projects p WHERE p.assigned_to = u.id
          ) THEN true
          WHEN u.role = 'MEMBER' AND EXISTS (
            SELECT 1 FROM project_members pm WHERE pm.member_id = u.id
          ) THEN true
          ELSE false
        END AS is_assigned
      FROM users u
      WHERE u.role IN ('TEAM_LEAD', 'MEMBER')
      ORDER BY u.role, u.id
    `);
        console.log("SUCCESS! Row count:", res.rowCount);
    } catch (err) {
        console.error("ERROR:", err.message);
    } finally {
        pool.end();
    }
}
run();
