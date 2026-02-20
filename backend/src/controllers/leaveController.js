const pool = require("../config/db");


// User applies leave

// Admin - view all leave requests


// Admin - approve or reject leave
exports.updateLeaveStatus = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { leaveId } = req.params;
    const { status } = req.body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    await pool.query(
      `
      UPDATE leave_requests
      SET status = $1,
          reviewed_by = $2,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $3
      `,
      [status, req.user.id, leaveId]
    );

    res.json({ message: `Leave ${status.toLowerCase()} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

