const pool = require("../config/db");

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = value => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// User check-in
exports.checkIn = async (req, res) => {
  try {
    console.log("📍 Received Location:", req.body);

    const userId = req.user.id;
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const { latitude, longitude } = req.body;
      const leaveCheck = await pool.query(`
  SELECT 1 FROM leave_requests
  WHERE user_id = $1
  AND status = 'APPROVED'
  AND CURRENT_DATE BETWEEN from_date AND to_date
`, [userId]);

if (leaveCheck.rows.length > 0) {
  return res.status(400).json({
    message: "You are on approved leave"
  });
}


    // 1️⃣ Prevent double check-in
    const existing = await pool.query(
      `SELECT * FROM attendance
       WHERE user_id = $1 AND date = $2`,
      [userId, today]
    );

    if (existing.rows.length > 0 && existing.rows[0].check_in) {
      return res.status(400).json({
        message: "Already checked in today"
      });
    }
    // 🔹 Check if geo restriction is enabled
const geoSetting = await pool.query(`
  SELECT geo_enabled FROM system_settings LIMIT 1
`);

const geoEnabled = geoSetting.rows[0]?.geo_enabled;

    // 1️⃣ Fetch office location
const office = await pool.query(`
  SELECT latitude, longitude, allowed_radius
  FROM office_settings
  LIMIT 1
`);

if (office.rows.length === 0) {
  return res.status(400).json({ message: "Office location not configured" });
}

const officeLat = office.rows[0].latitude;
const officeLon = office.rows[0].longitude;
const allowedRadius = office.rows[0].allowed_radius;

// 2️⃣ Validate coordinates
if (!latitude || !longitude) {
  return res.status(400).json({
    message: "Location required for check-in"
  });
}

// 3️⃣ Calculate distance
const distance = getDistanceInMeters(
  latitude,
  longitude,
  officeLat,
  officeLon
  
);
console.log("📏 Distance from office:", distance);


// 🔹 Apply geo validation ONLY if enabled
if (geoEnabled && distance > allowedRadius) {
  return res.status(403).json({
    message: "You are outside office location"
  });
}
    // 2️⃣ Get both shifts ordered
    const shiftRes = await pool.query(
      `SELECT * FROM shifts ORDER BY check_in_time ASC`
    );

    if (shiftRes.rows.length < 2) {
      return res.status(500).json({
        message: "Two shifts must be configured"
      });
    }

    const shift1 = shiftRes.rows[0];
    const shift2 = shiftRes.rows[1];

    const todayDate = new Date();

    function buildTime(timeString) {
      const [h, m, s] = timeString.split(":");
      const t = new Date();
      t.setHours(h, m, s, 0);
      return t;
    }

    const shift1Last = buildTime(shift1.last_checkin_time);
    const shift2Last = buildTime(shift2.last_checkin_time);

    let selectedShift = null;

    // 3️⃣ Auto select shift
    if (now <= shift1Last) {
      selectedShift = shift1;
    } else if (now <= shift2Last) {
      selectedShift = shift2;
    }

    // 4️⃣ Missed both shifts
    if (!selectedShift) {
      await pool.query(
        `INSERT INTO attendance (user_id, date, status)
         VALUES ($1, $2, 'LATE')
         ON CONFLICT (user_id, date)
         DO UPDATE SET status = 'LATE'`,
        [userId, today]
      );

      return res.status(403).json({
        message: "Missed all shift check-in windows. Contact admin."
      });
    }

    // 5️⃣ Successful check-in
    await pool.query(
      `INSERT INTO attendance
       (user_id, date, check_in, status, shift_id)
       VALUES ($1, $2, NOW(), 'CHECKED_IN', $3)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         check_in = NOW(),
         status = 'CHECKED_IN',
         shift_id = $3`,
      [userId, today, selectedShift.id]
    );

    res.json({
      message: `Checked in under ${selectedShift.name}`
    });

  } catch (err) {
    console.error("Check-in error:", err);
    res.status(500).json({ message: "Server error" });
  }
  
};

// User check-out
exports.checkOut = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split("T")[0];

    const result = await pool.query(
      `SELECT * FROM attendance
       WHERE user_id = $1 AND date = $2`,
      [userId, today]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "You have not checked in today"
      });
    }

    const record = result.rows[0];

    if (record.check_out) {
      return res.status(400).json({
        message: "Already checked out"
      });
    }

    await pool.query(
      `UPDATE attendance
       SET check_out = NOW(),
           status = 'PRESENT'
       WHERE id = $1`,
      [record.id]
    );

    res.json({ message: "Checked out successfully" });

  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ================= ADMIN: MONTHLY ATTENDANCE SUMMARY =================

// Get logged-in user's today status
exports.getMyTodayStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT
        check_in,
        check_out,
        CASE
          WHEN check_in IS NOT NULL AND check_out IS NOT NULL THEN 'PRESENT'
          WHEN check_in IS NOT NULL AND check_out IS NULL THEN 'CHECKED_IN'
          ELSE 'ABSENT'
        END AS status
      FROM attendance
      WHERE user_id = $1 AND date = CURRENT_DATE
    `, [userId]);

    if (result.rows.length === 0) {
      return res.json({ status: "ABSENT" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get status" });
  }
};
// ================= ADMIN: ALLOW LATE CHECK-IN =================


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

        COUNT(DISTINCT lr_day.day) AS leave_days

      FROM users u

      LEFT JOIN attendance a
        ON u.id = a.user_id
        AND a.date BETWEEN $1 AND $2

      LEFT JOIN (
        SELECT user_id, generate_series(from_date, to_date, interval '1 day')::date AS day
        FROM leave_requests
        WHERE status = 'APPROVED'
      ) lr_day
        ON lr_day.user_id = u.id
        AND lr_day.day BETWEEN $1 AND $2

      GROUP BY u.id
      ORDER BY u.id;
    `;

    const { rows } = await pool.query(query, [startDate, endDate]);

    const daysInMonth = new Date(
      Number(month.split("-")[0]),
      Number(month.split("-")[1]),
      0
    ).getDate();

    const result = rows.map(r => {
      const present = Number(r.present_days);
      const checkedIn = Number(r.checked_in_days);
      const onLeave = Number(r.leave_days);

      const absent =
        daysInMonth - present - checkedIn - onLeave;

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
      summary: result
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Monthly report error" });
  }
};
// Get logged-in user's today status
exports.getMyTodayStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT
        check_in,
        check_out,
        CASE
          WHEN check_in IS NOT NULL AND check_out IS NOT NULL THEN 'PRESENT'
          WHEN check_in IS NOT NULL AND check_out IS NULL THEN 'CHECKED_IN'
          ELSE 'ABSENT'
        END AS status
      FROM attendance
      WHERE user_id = $1 AND date = CURRENT_DATE
    `, [userId]);

    if (result.rows.length === 0) {
      return res.json({ status: "ABSENT" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get status" });
  }
};
// ================= ADMIN: ALLOW LATE CHECK-IN =================
exports.allowLateCheckIn = async (req, res) => {
  try {
    const { userId, shiftId } = req.body;

    const result = await pool.query(
      `UPDATE attendance
       SET status = 'CHECKED_IN',
           check_in = NOW(),
           shift_id = $2
       WHERE user_id = $1
         AND date = CURRENT_DATE
       RETURNING *`,
      [userId, shiftId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "No late record found"
      });
    }

    res.json({ message: "Late check-in approved" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.autoCreateTodayAttendance = async () => {
  try {
    const today = new Date().toISOString().split("T")[0];

    await pool.query(
      `
      INSERT INTO attendance (user_id, date, status)
      SELECT u.id, $1, 'ABSENT'
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1
        FROM attendance a
        WHERE a.user_id = u.id
          AND a.date = $1
      )
      `,
      [today]
    );

    console.log("✅ Today attendance auto-created");

  } catch (err) {
    console.error("❌ Auto attendance error:", err);
  }
};

// ================= ADMIN: TODAY ATTENDANCE DASHBOARD =================
exports.getTodayAttendanceDashboard = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(u.id) AS total_users,

        COUNT(a.id) FILTER (
          WHERE a.check_in IS NOT NULL
            AND a.check_out IS NULL
        ) AS checked_in,

        COUNT(a.id) FILTER (
          WHERE a.check_in IS NOT NULL
            AND a.check_out IS NOT NULL
        ) AS present,

        COUNT(lr.id) AS on_leave,

        COUNT(u.id)
        - COUNT(a.id) FILTER (
            WHERE a.check_in IS NOT NULL
              AND a.check_out IS NULL
          )
        - COUNT(a.id) FILTER (
            WHERE a.check_in IS NOT NULL
              AND a.check_out IS NOT NULL
          )
        - COUNT(lr.id) AS absent

      FROM users u

      LEFT JOIN attendance a
        ON a.user_id = u.id
        AND a.date = CURRENT_DATE

      LEFT JOIN leave_requests lr
        ON lr.user_id = u.id
        AND lr.status = 'APPROVED'
        AND CURRENT_DATE BETWEEN lr.from_date AND lr.to_date
    `);

    const row = result.rows[0];

    res.json({
      total_users: Number(row.total_users),
      checked_in: Number(row.checked_in),
      present: Number(row.present),
      on_leave: Number(row.on_leave),
      absent: Number(row.absent)
    });

  } catch (err) {
    console.error("Today dashboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getTodayAttendanceList = async (req, res) => {
  try {
    const result = await pool.query(`
  SELECT
    u.id        AS user_db_id,
    u.user_id   AS user_code,
    u.name,
    u.role,
    a.check_in,
    a.check_out,
    a.status
  FROM attendance a
  JOIN users u
    ON u.id = a.user_id
  WHERE a.date = CURRENT_DATE
  ORDER BY u.id
`);


    res.json(result.rows);
  } catch (err) {
    console.error("Today attendance list error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.getLateUsersToday = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.user_id,
        u.user_id AS user_code,
        u.name
      FROM attendance a
      JOIN users u ON u.id = a.user_id
      WHERE a.date = CURRENT_DATE
        AND a.status = 'LATE'
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Get late users error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.applyLeave = async (req, res) => {
  try {
    const userId = req.user.id;
    const { from_date, to_date, reason } = req.body;

    if (!from_date || !to_date || !reason) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    if (from_date > to_date) {
      return res.status(400).json({
        message: "Invalid date range"
      });
    }

    await pool.query(
      `
      INSERT INTO leave_requests
      (user_id, from_date, to_date, reason, status, applied_at)
      VALUES ($1, $2, $3, $4, 'PENDING', NOW())
      `,
      [userId, from_date, to_date, reason]
    );

    res.json({ message: "Leave request submitted successfully" });

  } catch (err) {
    console.error("Apply leave error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
