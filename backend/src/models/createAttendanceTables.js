require("dotenv").config();
const pool = require("../config/db");


const createAttendanceTables = async () => {
  try {
    // Admin-defined office timing
    await pool.query(`
      CREATE TABLE IF NOT EXISTS office_timings (
        id SERIAL PRIMARY KEY,
        check_in_time TIME NOT NULL,
        check_out_time TIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Attendance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL,
        check_in TIMESTAMP,
        check_out TIMESTAMP,
        status VARCHAR(20) DEFAULT 'ABSENT',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, date)
      )
    `);

    console.log("✅ Attendance tables created successfully");
  } catch (err) {
    console.error("❌ Error creating attendance tables:", err.message);
  }
};

createAttendanceTables();
