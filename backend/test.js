require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?sslmode=disable`,
});

(async () => {
  try {
    const res = await pool.query("SELECT 1");
    console.log("Connected successfully", res.rows);
  } catch (err) {
    console.error("Connection failed:", err.message);
  } finally {
    pool.end();
  }
})();