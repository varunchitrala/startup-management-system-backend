console.log("👉 db.js file loaded");

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: {
    rejectUnauthorized: false,
  },
});

// 🔥 FORCE search_path to public for every new connection
pool.on("connect", async (client) => {
  try {
    await client.query("SET search_path TO public");
    console.log("✅ search_path set to public");
  } catch (err) {
    console.error("❌ Failed to set search_path:", err.message);
  }
});

// 🔥 Force a test connection
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL connected successfully");
  } catch (err) {
    console.error("❌ PostgreSQL connection failed:", err.message);
  }
})();

module.exports = pool;