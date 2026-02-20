const pool = require("../config/db");

/* ================= HELPER: WEEK RANGE ================= */
const getWeekRange = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    weekStart: monday.toISOString().split("T")[0],
    weekEnd: sunday.toISOString().split("T")[0]
  };
};

/* ================= DAILY REPORT ================= */
exports.submitDailyReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, work_done } = req.body;

    if (!work_done) {
      return res.status(400).json({ message: "Work details are required" });
    }

    const today = new Date().toISOString().split("T")[0];

    await pool.query(
      `
      INSERT INTO work_reports
        (user_id, report_type, report_date, title, work_done)
      VALUES
        ($1, 'DAILY', $2, $3, $4)
      `,
      [userId, today, title || null, work_done]
    );

    res.json({ message: "Daily work report submitted" });

  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(400)
        .json({ message: "Daily report already submitted" });
    }

    console.error("Daily report error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= WEEKLY REPORT ================= */
exports.submitWeeklyReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, work_done } = req.body;

    if (!work_done) {
      return res.status(400).json({ message: "Work details are required" });
    }

    const { weekStart, weekEnd } = getWeekRange();

    await pool.query(
      `
      INSERT INTO work_reports
        (user_id, report_type, week_start, week_end, title, work_done)
      VALUES
        ($1, 'WEEKLY', $2, $3, $4, $5)
      `,
      [userId, weekStart, weekEnd, title || null, work_done]
    );

    res.json({ message: "Weekly work report submitted" });

  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({
        message: "Weekly report already submitted"
      });
    }

    console.error("Weekly report error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.getMyReports = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;

    if (!["DAILY", "WEEKLY"].includes(type)) {
      return res.status(400).json({
        message: "Invalid report type"
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        report_type,
        report_date,
        week_start,
        week_end,
        title,
        work_done,
        created_at
      FROM work_reports
      WHERE user_id = $1
        AND report_type = $2
      ORDER BY created_at DESC
      `,
      [userId, type]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get my reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
