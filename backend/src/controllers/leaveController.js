const pool = require("../config/db");

const emailService = require('../services/emailService');
// User applies leave

// Admin - view all leave requests


// Admin - approve or reject leave
exports.updateLeaveStatus = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { leaveId } = req.params;
    const { status, rejection_reason } = req.body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const leaveResult = await pool.query(
      'SELECT * FROM leave_requests WHERE id = $1',
      [leaveId]
    );

    if (leaveResult.rows.length === 0) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    const leaveRequest = leaveResult.rows[0];

    // Update status (only columns that exist in the table)
    await pool.query(
      `UPDATE leave_requests SET status = $1 WHERE id = $2`,
      [status, leaveId]
    );

    // Build notification with reason
    const emoji = status === "APPROVED" ? "\u2705" : "\u274c";
    let notifMessage;
    if (status === "REJECTED" && rejection_reason && rejection_reason.trim()) {
      notifMessage = `${emoji} Your leave request (${leaveRequest.from_date} \u2192 ${leaveRequest.to_date}) has been REJECTED. Reason: ${rejection_reason.trim()}`;
    } else {
      notifMessage = `${emoji} Your leave request (${leaveRequest.from_date} \u2192 ${leaveRequest.to_date}) has been ${status} by Admin.`;
    }

    await pool.query(
      `INSERT INTO notifications (user_id, message, is_read, created_at)
       VALUES ($1, $2, false, NOW())`,
      [leaveRequest.user_id, notifMessage]
    );

    // Try email — never crash the endpoint if it fails
    try {
      if (status === "APPROVED") {
        await emailService.sendLeaveApprovedEmail(leaveRequest.user_id, leaveRequest);
      } else {
        await emailService.sendLeaveRejectedEmail(leaveRequest.user_id, leaveRequest, rejection_reason);
      }
    } catch (emailErr) {
      console.warn("Email notification failed (non-fatal):", emailErr.message);
    }

    res.json({ message: `Leave ${status.toLowerCase()} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
