require("dotenv").config();
const express = require("express");
const cors = require("cors");
// Initialize email scheduler
require('./src/scheduler/emailScheduler');
const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= DB INIT ================= */
require("./src/config/db");
require("./src/models/initDb");
require("./src/models/createAttendanceTables");
const addShiftCheckoutColumns = require("./src/models/addShiftCheckoutColumns");
addShiftCheckoutColumns();

/* ================= ROUTES ================= */
const authRoutes = require("./src/routes/authRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const attendanceRoutes = require("./src/routes/attendanceRoutes");
const workReportRoutes = require("./src/routes/workReportRoutes");
const leadRoutes = require("./src/routes/leadRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
// Add with other routes
const testRoutes = require('./src/routes/testRoutes');
app.use('/api/test', testRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/work", workReportRoutes);
app.use("/api/lead", leadRoutes);
app.use("/api/notifications", notificationRoutes);
/* ================= AUTOMATION ================= */

const { autoCreateTodayAttendance } = require("./src/controllers/attendanceController");
const runAttendanceAutomation = require("./src/jobs/attendanceCron");

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Run once on startup
  await autoCreateTodayAttendance();

  // Start cron automation
  runAttendanceAutomation();
});
