const pool = require("../config/db");
const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
};

exports.getAllWorkReports = async (req, res) => {
  try {
    const { type, date, user_id, role } = req.query;

    let conditions = [];
    let values = [];

    if (type) {
      values.push(type);
      conditions.push(`wr.report_type = $${values.length}`);
    }

    if (date) {
      values.push(date);
      conditions.push(`wr.report_date = $${values.length}`);
    }

    if (user_id) {
      values.push(user_id);
      conditions.push(`u.id = $${values.length}`);
    }

    if (role) {
      values.push(role);
      conditions.push(`u.role = $${values.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT
        wr.id,
        wr.report_type,
        wr.report_date,
        wr.week_start,
        wr.week_end,
        wr.title,
        wr.work_done,
        wr.skills_learned,
        wr.project_update,
        wr.created_at,
        u.user_id,
        u.name,
        u.role
      FROM work_reports wr
      JOIN users u ON u.id = wr.user_id
      ${whereClause}
      ORDER BY wr.created_at DESC
    `;

    const result = await pool.query(query, values);
    res.json(result.rows);

  } catch (err) {
    console.error("Admin work reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.getUsersMissingDailyReport = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const result = await pool.query(`
      SELECT
        u.id,
        u.user_id,
        u.name,
        u.role
      FROM users u
      LEFT JOIN work_reports wr
        ON wr.user_id = u.id
        AND wr.report_type = 'DAILY'
        AND wr.report_date = $1
      WHERE wr.id IS NULL
      ORDER BY u.role, u.name
    `, [today]);

    res.json({
      date: today,
      missing_count: result.rows.length,
      users: result.rows
    });

  } catch (err) {
    console.error("Missing daily reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.getTodayCompliance = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const result = await pool.query(`
      SELECT
        COUNT(u.id) AS total_users,
        COUNT(wr.id) AS submitted_reports,
        COUNT(u.id) - COUNT(wr.id) AS missing_reports
      FROM users u
      LEFT JOIN work_reports wr
        ON wr.user_id = u.id
        AND wr.report_type = 'DAILY'
        AND wr.report_date = $1
    `, [today]);

    const row = result.rows[0];

    res.json({
      date: today,
      total_users: Number(row.total_users),
      submitted_reports: Number(row.submitted_reports),
      missing_reports: Number(row.missing_reports),
      compliance_percent:
        row.total_users == 0
          ? 0
          : Math.round((row.submitted_reports / row.total_users) * 100)
    });

  } catch (err) {
    console.error("Compliance dashboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.getWeeklyCompliance = async (req, res) => {
  try {
    const weekStart = getWeekStart();

    const result = await pool.query(`
      SELECT
        COUNT(u.id) AS total_users,
        COUNT(wr.id) AS submitted_reports,
        COUNT(u.id) - COUNT(wr.id) AS missing_reports
      FROM users u
      LEFT JOIN work_reports wr
        ON wr.user_id = u.id
        AND wr.report_type = 'WEEKLY'
        AND wr.week_start = $1
    `, [weekStart]);

    const row = result.rows[0];

    const total = Number(row.total_users);
    const submitted = Number(row.submitted_reports);

    res.json({
      week_start: weekStart,
      total_users: total,
      submitted_reports: submitted,
      missing_reports: total - submitted,
      compliance_percent:
        total === 0 ? 0 : Math.round((submitted / total) * 100)
    });

  } catch (err) {
    console.error("Weekly compliance error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.exportWorkReportsCSV = async (req, res) => {
  try {
    const { from, to } = req.query;

    let dateFilter = "wr.report_date = CURRENT_DATE";
    let values = [];

    if (from && to) {
      dateFilter = "wr.report_date BETWEEN $1 AND $2";
      values = [from, to];
    }

    const result = await pool.query(`
      SELECT 
        u.name,
        u.role,
        wr.report_type,
        wr.work_done,
        wr.report_date,
        wr.created_at
      FROM work_reports wr
      JOIN users u ON u.id = wr.user_id
      WHERE ${dateFilter}
      ORDER BY wr.created_at DESC
    `, values);

    let csv =
      "Name,Role,Report Type,Work Done,Skills Learned,Project Update,Report Date,Submitted At\n";

    result.rows.forEach(row => {
      const safeWorkDone = (row.work_done || "")
        .replace(/"/g, '""')
        .replace(/\n/g, " ");
      const safeSkills = (row.skills_learned || "")
        .replace(/"/g, '""')
        .replace(/\n/g, " ");
      const safeProjectUpdate = (row.project_update || "")
        .replace(/"/g, '""')
        .replace(/\n/g, " ");

      csv += `"${row.name}","${row.role}","${row.report_type}","${safeWorkDone}","${safeSkills}","${safeProjectUpdate}","${row.report_date}","${row.created_at}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=work_reports.csv"
    );

    res.send(csv);

  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ message: "CSV export failed" });
  }
};

const ExcelJS = require("exceljs");

exports.exportWorkReportsExcel = async (req, res) => {
  try {
    const { from, to } = req.query;

    let dateFilter = "wr.report_date = CURRENT_DATE";
    let values = [];

    if (from && to) {
      dateFilter = "wr.report_date BETWEEN $1 AND $2";
      values = [from, to];
    }

    const result = await pool.query(`
      SELECT 
        u.name,
        u.role,
        wr.report_type,
        wr.work_done,
        wr.report_date,
        wr.created_at
      FROM work_reports wr
      JOIN users u ON u.id = wr.user_id
      WHERE ${dateFilter}
      ORDER BY wr.created_at DESC
    `, values);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Work Reports");

    worksheet.columns = [
      { header: "Name", key: "name", width: 20 },
      { header: "Role", key: "role", width: 15 },
      { header: "Report Type", key: "report_type", width: 15 },
      { header: "Work Done", key: "work_done", width: 40 },
      { header: "Skills Learned", key: "skills_learned", width: 40 },
      { header: "Project Update", key: "project_update", width: 40 },
      { header: "Report Date", key: "report_date", width: 15 },
      { header: "Submitted At", key: "created_at", width: 25 }
    ];

    result.rows.forEach(row => {
      worksheet.addRow(row);
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=work_reports.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Excel export error:", err);
    res.status(500).json({ message: "Excel export failed" });
  }
};
exports.getTodayWorkReportDashboard = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.user_id,
        u.name,
        u.role,
        s.name AS shift_name,

        CASE
          WHEN a.check_in IS NOT NULL AND a.check_out IS NOT NULL THEN 'PRESENT'
          WHEN a.check_in IS NOT NULL AND a.check_out IS NULL THEN 'CHECKED_IN'
          ELSE 'ABSENT'
        END AS attendance_status,

        a.check_in,
        a.check_out,

        CASE
          WHEN wr.id IS NOT NULL THEN 'SUBMITTED'
          ELSE 'NOT_SUBMITTED'
        END AS work_report_status,

        a.force_checked_out,
        a.shift_id

      FROM users u

      LEFT JOIN attendance a
        ON a.user_id = u.id
        AND a.date = CURRENT_DATE

      LEFT JOIN shifts s
        ON s.id = a.shift_id

      LEFT JOIN work_reports wr
        ON wr.user_id = u.id
        AND wr.report_date = CURRENT_DATE
        AND wr.report_type = 'DAILY'

      ORDER BY
        CASE u.role
          WHEN 'ADMIN' THEN 1
          WHEN 'TEAM_LEAD' THEN 2
          WHEN 'MEMBER' THEN 3
        END,
        u.id
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Work report dashboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
