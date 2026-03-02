const pool = require("../config/db");


exports.forceCheckoutAll = async (req, res) => {
  try {
    // 🔐 Admin only
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied" });
    }

    const today = new Date().toISOString().split("T")[0];

    // Force checkout everyone who is checked in but not checked out
    const result = await pool.query(
      `
      UPDATE attendance
      SET check_out = CURRENT_TIMESTAMP
      WHERE "date" = $1
        AND check_in IS NOT NULL
        AND check_out IS NULL
      `,
      [today]
    );

    res.json({
      message: "Force checkout completed",
      checked_out_users: result.rowCount
    });

  } catch (err) {
    console.error("Force checkout all error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getTodayAttendance = async (req, res) => {
  try {
    const query = `
      WITH day_meta AS (
        SELECT EXISTS (
          SELECT 1 FROM holidays WHERE holiday_date = CURRENT_DATE
        ) OR EXTRACT(DOW FROM CURRENT_DATE) = 0 AS is_holiday
      )
      SELECT 
        u.user_id,
        u.name,
        u.role,
        a.check_in,
        a.check_out,
        a.status,
        dm.is_holiday
      FROM users u
      CROSS JOIN day_meta dm
      LEFT JOIN attendance a
        ON u.id = a.user_id
        AND a.date = CURRENT_DATE
      ORDER BY u.id;
    `;

    const { rows } = await pool.query(query);

    const data = rows.map(r => {
      let status = "ABSENT";
      if (r.status === "HOLIDAY" || r.is_holiday) status = "HOLIDAY";
      if (r.check_in && !r.check_out) status = "CHECKED_IN";
      if (r.check_in && r.check_out) status = "PRESENT";

      return {
        user_id: r.user_id,
        name: r.name,
        role: r.role,
        check_in: r.check_in,
        check_out: r.check_out,
        status
      };
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch attendance" });
  }
};
exports.getDashboardSummary = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // total users
    const totalUsers = await pool.query(
      "SELECT COUNT(*) FROM users"
    );

    // present
    const present = await pool.query(`
      SELECT COUNT(*) FROM attendance
      WHERE date = $1
        AND check_in IS NOT NULL
        AND check_out IS NOT NULL
    `, [today]);

    // checked in only
    const checkedIn = await pool.query(`
      SELECT COUNT(*) FROM attendance
      WHERE date = $1
        AND check_in IS NOT NULL
        AND check_out IS NULL
    `, [today]);

    // on leave
    const onLeave = await pool.query(`
      SELECT COUNT(*) FROM leave_requests
      WHERE status = 'APPROVED'
        AND $1 BETWEEN from_date AND to_date
    `, [today]);

    const holiday = await pool.query(`
      SELECT COUNT(*) FROM attendance
      WHERE date = $1
        AND status = 'HOLIDAY'
    `, [today]);

    // absent = total - present - checkedin - onleave - holiday
    const absent =
      totalUsers.rows[0].count -
      present.rows[0].count -
      checkedIn.rows[0].count -
      onLeave.rows[0].count -
      holiday.rows[0].count;

    res.json({
      total_users: Number(totalUsers.rows[0].count),
      present: Number(present.rows[0].count),
      checked_in: Number(checkedIn.rows[0].count),
      on_leave: Number(onLeave.rows[0].count),
      holiday: Number(holiday.rows[0].count),
      absent: Math.max(0, Number(absent))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Dashboard error" });
  }
};
exports.getDailyAttendanceReport = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const query = `
      WITH day_meta AS (
        SELECT EXISTS (
          SELECT 1 FROM holidays WHERE holiday_date = $1::date
        ) OR EXTRACT(DOW FROM $1::date) = 0 AS is_holiday
      )
      SELECT 
        u.user_id,
        u.name,
        u.role,
        a.check_in,
        a.check_out,
        lr.id AS leave_id,
        a.status,
        dm.is_holiday
      FROM users u
      CROSS JOIN day_meta dm
      LEFT JOIN attendance a
        ON u.id = a.user_id
        AND a.date = $1
      LEFT JOIN leave_requests lr
        ON lr.user_id = u.id
        AND lr.status = 'APPROVED'
        AND $1 BETWEEN lr.from_date AND lr.to_date
      ORDER BY u.id;
    `;

    const { rows } = await pool.query(query, [date]);

    const result = rows.map(r => {
      let status = "ABSENT";

      if (r.leave_id) status = "ON_LEAVE";
      else if (r.status === "HOLIDAY" || r.is_holiday) status = "HOLIDAY";
      else if (r.check_in && r.check_out) status = "PRESENT";
      else if (r.check_in && !r.check_out) status = "CHECKED_IN";

      return {
        user_id: r.user_id,
        name: r.name,
        role: r.role,
        check_in: r.check_in,
        check_out: r.check_out,
        status
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Daily report error" });
  }
};
exports.exportDailyAttendanceCSV = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const result = await pool.query(`
      WITH day_meta AS (
        SELECT EXISTS (
          SELECT 1 FROM holidays WHERE holiday_date = $1::date
        ) OR EXTRACT(DOW FROM $1::date) = 0 AS is_holiday
      )
      SELECT
        u.user_id,
        u.name,
        u.role,
        a.check_in,
        a.check_out,
        a.status,
        dm.is_holiday
      FROM users u
      CROSS JOIN day_meta dm
      LEFT JOIN attendance a
        ON a.user_id = u.id
        AND a.date = $1
      ORDER BY u.id
    `, [date]);

    let csv = "User ID,Name,Role,Check In,Check Out,Status\n";

    result.rows.forEach(r => {
      const status = r.status || (r.is_holiday ? "HOLIDAY" : "ABSENT");
      csv += `${r.user_id},${r.name},${r.role},${r.check_in || ""},${r.check_out || ""},${status}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${date}.csv`
    );

    res.send(csv);

  } catch (err) {
    console.error("Daily CSV export error:", err);
    res.status(500).json({ message: "CSV export failed" });
  }
};

const ExcelJS = require("exceljs");

exports.exportDailyAttendanceExcel = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const result = await pool.query(`
      WITH day_meta AS (
        SELECT EXISTS (
          SELECT 1 FROM holidays WHERE holiday_date = $1::date
        ) OR EXTRACT(DOW FROM $1::date) = 0 AS is_holiday
      )
      SELECT
        u.user_id,
        u.name,
        u.role,
        a.check_in,
        a.check_out,
        a.status,
        dm.is_holiday
      FROM users u
      CROSS JOIN day_meta dm
      LEFT JOIN attendance a
        ON a.user_id = u.id
        AND a.date = $1
      ORDER BY u.id
    `, [date]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Daily Attendance");

    sheet.columns = [
      { header: "User ID", key: "user_id", width: 15 },
      { header: "Name", key: "name", width: 20 },
      { header: "Role", key: "role", width: 15 },
      { header: "Check In", key: "check_in", width: 20 },
      { header: "Check Out", key: "check_out", width: 20 },
      { header: "Status", key: "status", width: 15 }
    ];

    result.rows.forEach(r => {
      sheet.addRow({
        user_id: r.user_id,
        name: r.name,
        role: r.role,
        check_in: r.check_in || "-",
        check_out: r.check_out || "-",
        status: r.status || (r.is_holiday ? "HOLIDAY" : "ABSENT")
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${date}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Daily Excel export error:", err);
    res.status(500).json({ message: "Excel export failed" });
  }
};

exports.getMonthlyAttendanceSummary = async (req, res) => {
  try {
    const { month } = req.query; // format: YYYY-MM

    if (!month) {
      return res.status(400).json({ message: "Month is required (YYYY-MM)" });
    }

    const startDate = `${month}-01`;
    const endDate = `${month}-31`; // safe upper bound

    const query = `
      SELECT
        u.user_id,
        u.name,
        u.role,

        COUNT(DISTINCT a.date) FILTER (
          WHERE a.check_in IS NOT NULL AND a.check_out IS NOT NULL
        ) AS present_days,

        COUNT(DISTINCT a.date) FILTER (
          WHERE a.check_in IS NOT NULL AND a.check_out IS NULL
        ) AS checked_in_days,

        COUNT(DISTINCT lr_days.day) AS leave_days

      FROM users u

      LEFT JOIN attendance a
        ON u.id = a.user_id
        AND a.date BETWEEN $1 AND $2

      LEFT JOIN (
        SELECT 
          user_id,
          generate_series(from_date, to_date, interval '1 day')::date AS day
        FROM leave_requests
        WHERE status = 'APPROVED'
      ) lr_days
        ON lr_days.user_id = u.id
        AND lr_days.day BETWEEN $1 AND $2

      GROUP BY u.id
      ORDER BY u.id;
    `;

    const { rows } = await pool.query(query, [startDate, endDate]);

    const daysInMonth = new Date(
      Number(month.split("-")[0]),
      Number(month.split("-")[1]),
      0
    ).getDate();
    const holidayDaysResult = await pool.query(
      `SELECT COUNT(*)::int AS holiday_days
       FROM (
         SELECT d::date AS day
         FROM generate_series($1::date, $2::date, interval '1 day') d
         WHERE EXTRACT(DOW FROM d::date) = 0
            OR EXISTS (
              SELECT 1
              FROM holidays h
              WHERE h.holiday_date = d::date
            )
       ) non_working`,
      [startDate, endDate]
    );
    const holidayDays = Number(holidayDaysResult.rows[0]?.holiday_days || 0);

    const summary = rows.map(r => {
      const present = Number(r.present_days);
      const checkedIn = Number(r.checked_in_days);
      const onLeave = Number(r.leave_days);

      const absent =
        daysInMonth - holidayDays - present - checkedIn - onLeave;

      return {
        user_id: r.user_id,
        name: r.name,
        role: r.role,
        present_days: present,
        checked_in_days: checkedIn,
        on_leave_days: onLeave,
        absent_days: absent < 0 ? 0 : absent
      };
    });

    res.json({
      month,
      days_in_month: daysInMonth,
      holiday_days: holidayDays,
      summary
    });
  } catch (err) {
    console.error("Monthly attendance error:", err);
    res.status(500).json({ message: "Monthly attendance report failed" });
  }
};
exports.exportMonthlyAttendanceCSV = async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM

    if (!month) {
      return res.status(400).json({ message: "Month is required (YYYY-MM)" });
    }

    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const query = `
      SELECT
        u.user_id,
        u.name,
        u.role,

        COUNT(DISTINCT a.date) FILTER (
          WHERE a.check_in IS NOT NULL AND a.check_out IS NOT NULL
        ) AS present_days,

        COUNT(DISTINCT a.date) FILTER (
          WHERE a.check_in IS NOT NULL AND a.check_out IS NULL
        ) AS checked_in_days,

        COUNT(DISTINCT lr_days.day) AS leave_days

      FROM users u

      LEFT JOIN attendance a
        ON u.id = a.user_id
        AND a.date BETWEEN $1 AND $2

      LEFT JOIN (
        SELECT 
          user_id,
          generate_series(from_date, to_date, interval '1 day')::date AS day
        FROM leave_requests
        WHERE status = 'APPROVED'
      ) lr_days
        ON lr_days.user_id = u.id
        AND lr_days.day BETWEEN $1 AND $2

      GROUP BY u.id
      ORDER BY u.id;
    `;

    const { rows } = await pool.query(query, [startDate, endDate]);

    const daysInMonth = new Date(
      Number(month.split("-")[0]),
      Number(month.split("-")[1]),
      0
    ).getDate();
    const holidayDaysResult = await pool.query(
      `SELECT COUNT(*)::int AS holiday_days
       FROM (
         SELECT d::date AS day
         FROM generate_series($1::date, $2::date, interval '1 day') d
         WHERE EXTRACT(DOW FROM d::date) = 0
            OR EXISTS (
              SELECT 1
              FROM holidays h
              WHERE h.holiday_date = d::date
            )
       ) non_working`,
      [startDate, endDate]
    );
    const holidayDays = Number(holidayDaysResult.rows[0]?.holiday_days || 0);

    // CSV header
    let csv = "User ID,Name,Role,Present Days,Checked-in Days,On Leave Days,Absent Days\n";

    rows.forEach(r => {
      const present = Number(r.present_days);
      const checkedIn = Number(r.checked_in_days);
      const onLeave = Number(r.leave_days);
      const absent = Math.max(daysInMonth - holidayDays - present - checkedIn - onLeave, 0);

      csv += `${r.user_id},${r.name},${r.role},${present},${checkedIn},${onLeave},${absent}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${month}.csv`
    );

    res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ message: "CSV export failed" });
  }
};


exports.exportMonthlyAttendanceExcel = async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM

    if (!month) {
      return res.status(400).json({ message: "Month is required (YYYY-MM)" });
    }

    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const query = `
      SELECT
        u.user_id,
        u.name,
        u.role,

        COUNT(DISTINCT a.date) FILTER (
          WHERE a.check_in IS NOT NULL AND a.check_out IS NOT NULL
        ) AS present_days,

        COUNT(DISTINCT a.date) FILTER (
          WHERE a.check_in IS NOT NULL AND a.check_out IS NULL
        ) AS checked_in_days,

        COUNT(DISTINCT lr_days.day) AS leave_days

      FROM users u

      LEFT JOIN attendance a
        ON u.id = a.user_id
        AND a.date BETWEEN $1 AND $2

      LEFT JOIN (
        SELECT 
          user_id,
          generate_series(from_date, to_date, interval '1 day')::date AS day
        FROM leave_requests
        WHERE status = 'APPROVED'
      ) lr_days
        ON lr_days.user_id = u.id
        AND lr_days.day BETWEEN $1 AND $2

      GROUP BY u.id
      ORDER BY u.id;
    `;

    const { rows } = await pool.query(query, [startDate, endDate]);

    const daysInMonth = new Date(
      Number(month.split("-")[0]),
      Number(month.split("-")[1]),
      0
    ).getDate();
    const holidayDaysResult = await pool.query(
      `SELECT COUNT(*)::int AS holiday_days
       FROM (
         SELECT d::date AS day
         FROM generate_series($1::date, $2::date, interval '1 day') d
         WHERE EXTRACT(DOW FROM d::date) = 0
            OR EXISTS (
              SELECT 1
              FROM holidays h
              WHERE h.holiday_date = d::date
            )
       ) non_working`,
      [startDate, endDate]
    );
    const holidayDays = Number(holidayDaysResult.rows[0]?.holiday_days || 0);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance");

    sheet.columns = [
      { header: "User ID", key: "user_id", width: 15 },
      { header: "Name", key: "name", width: 20 },
      { header: "Role", key: "role", width: 15 },
      { header: "Present Days", key: "present", width: 15 },
      { header: "Checked-in Days", key: "checkedIn", width: 18 },
      { header: "On Leave Days", key: "onLeave", width: 15 },
      { header: "Absent Days", key: "absent", width: 15 }
    ];

    rows.forEach(r => {
      const present = Number(r.present_days);
      const checkedIn = Number(r.checked_in_days);
      const onLeave = Number(r.leave_days);
      const absent = Math.max(daysInMonth - holidayDays - present - checkedIn - onLeave, 0);

      sheet.addRow({
        user_id: r.user_id,
        name: r.name,
        role: r.role,
        present,
        checkedIn,
        onLeave,
        absent
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${month}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Excel export error:", err);
    res.status(500).json({ message: "Excel export failed" });
  }
};
exports.getTodayAttendanceDashboard = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.user_id,
        u.name,
        u.role,
        a.check_in,
        a.check_out,

        CASE
          WHEN a.status = 'HOLIDAY' THEN 'HOLIDAY'
          WHEN lr.id IS NOT NULL THEN 'ON_LEAVE'
          WHEN a.status = 'LATE' THEN 'LATE'
          WHEN a.check_in IS NOT NULL AND a.check_out IS NOT NULL THEN 'PRESENT'
          WHEN a.check_in IS NOT NULL AND a.check_out IS NULL THEN 'CHECKED_IN'
          ELSE 'ABSENT'
        END AS status

      FROM users u

      LEFT JOIN attendance a
        ON a.user_id = u.id
        AND a.date = CURRENT_DATE

      LEFT JOIN leave_requests lr
        ON lr.user_id = u.id
        AND lr.status = 'APPROVED'
        AND CURRENT_DATE BETWEEN lr.from_date AND lr.to_date

      ORDER BY u.id
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Admin attendance dashboard error:", err);
    res.status(500).json({ message: "Failed to fetch attendance dashboard" });
  }
};

exports.autoProcessAttendance = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const holidayRes = await pool.query(
      `SELECT 1
       FROM holidays
       WHERE holiday_date = $1
          OR EXTRACT(DOW FROM $1::date) = 0
       LIMIT 1`,
      [today]
    );
    const fallbackStatus = holidayRes.rows.length > 0 ? "HOLIDAY" : "ABSENT";

    await pool.query(`
      INSERT INTO attendance (user_id, date, status)
      SELECT
        u.id,
        $1,
        $2
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM attendance a
        WHERE a.user_id = u.id
          AND a.date = $1
      )
    `, [today, fallbackStatus]);

    res.json({ message: `Attendance auto processed successfully (${fallbackStatus})` });

  } catch (err) {
    console.error("Auto attendance error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.toggleGeoSetting = async (req, res) => {
  try {
    const geo_enabled = req.body.geo_enabled ?? req.body.is_enabled;

    await pool.query(`
      UPDATE system_settings
      SET geo_enabled = $1,
          updated_at = CURRENT_TIMESTAMP
    `, [geo_enabled]);

    res.json({
      message: geo_enabled
        ? "Geo restriction enabled"
        : "Geo restriction disabled"
    });

  } catch (err) {
    console.error("Toggle geo error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.getGeoSetting = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT geo_enabled FROM system_settings LIMIT 1
    `);

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
exports.updateGeoSetting = async (req, res) => {

  try {
    const { is_enabled } = req.body;

    await pool.query(
      `
      UPDATE system_settings
      SET geo_enabled = $1
      WHERE id = 1
      `,
      [is_enabled]
    );

    res.json({ message: "Geo setting updated successfully" });

  } catch (err) {
    console.error("Update geo setting error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= OFFICE SETTINGS ================= */

exports.getOfficeSettings = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT latitude, longitude, allowed_radius FROM office_settings LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.json({ latitude: null, longitude: null, allowed_radius: 100 });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get office settings error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateOfficeSettings = async (req, res) => {
  try {
    const { latitude, longitude, allowed_radius } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Latitude and longitude are required" });
    }

    const existing = await pool.query(`SELECT id FROM office_settings LIMIT 1`);

    if (existing.rows.length > 0) {
      await pool.query(`
        UPDATE office_settings
        SET latitude = $1, longitude = $2, allowed_radius = $3
        WHERE id = $4
      `, [latitude, longitude, allowed_radius || 100, existing.rows[0].id]);
    } else {
      await pool.query(`
        INSERT INTO office_settings (latitude, longitude, allowed_radius)
        VALUES ($1, $2, $3)
      `, [latitude, longitude, allowed_radius || 100]);
    }

    res.json({ message: "Office location updated successfully" });
  } catch (err) {
    console.error("Update office settings error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
