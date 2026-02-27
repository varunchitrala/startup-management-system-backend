require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= DB INIT ================= */
require("./src/config/db");

/* ================= ROUTES ================= */
const authRoutes = require("./src/routes/authRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const attendanceRoutes = require("./src/routes/attendanceRoutes");
const workReportRoutes = require("./src/routes/workReportRoutes");
const leaveRoutes = require("./src/routes/leaveRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/work", workReportRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/notifications", notificationRoutes);
/* ================= AUTOMATION ================= */

const { autoCreateTodayAttendance } = require("./src/controllers/attendanceController");
const runAttendanceAutomation = require("./src/jobs/attendanceCron");

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`✅ Server running on port ${PORT}`);

  // Run once on startup
  await autoCreateTodayAttendance();

  // Start cron automation
  runAttendanceAutomation();
});
