require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const result = await pool.query('SELECT id, email, role, LEFT(password, 15) as pwd_start FROM users LIMIT 5');
    console.log('Users found:', result.rows.length);
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error('DB ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

test();
