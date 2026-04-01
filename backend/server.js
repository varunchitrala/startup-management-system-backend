require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Note: Cron jobs handled by Vercel Cron (see vercel.json)
// emailScheduler and attendanceCron replaced by /api/cron/* routes

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= DB INIT (non-fatal) ================= */
try {
  require("./src/config/db");
} catch (e) {
  console.error("DB config load error:", e.message);
}
try {
  require("./src/models/initDb");
} catch (e) {
  console.error("initDb error:", e.message);
}
try {
  require("./src/models/createAttendanceTables");
} catch (e) {
  console.error("createAttendanceTables error:", e.message);
}
try {
  const addShiftCheckoutColumns = require("./src/models/addShiftCheckoutColumns");
  addShiftCheckoutColumns();
} catch (e) {
  console.error("addShiftCheckoutColumns error:", e.message);
}

/* ================= ROUTES ================= */
const authRoutes = require("./src/routes/authRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const attendanceRoutes = require("./src/routes/attendanceRoutes");
const workReportRoutes = require("./src/routes/workReportRoutes");
const leadRoutes = require("./src/routes/leadRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const testRoutes = require('./src/routes/testRoutes');

app.use('/api/test', testRoutes);
app.get('/health', (req, res) => res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/work", workReportRoutes);
app.use("/api/lead", leadRoutes);
app.use("/api/notifications", notificationRoutes);

/* ================= 404 FALLBACK ================= */
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

/* ================= SERVER ================= */

// Export app for Vercel
module.exports = app;

// Only listen locally (not on Vercel)
if (require.main === module) {
  const { autoCreateTodayAttendance } = require("./src/controllers/attendanceController");
  const runAttendanceAutomation = require("./src/jobs/attendanceCron");
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await autoCreateTodayAttendance();
    runAttendanceAutomation();
  });
}
