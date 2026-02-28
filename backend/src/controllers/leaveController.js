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
    const { status, rejection_reason } = req.body; // Add rejection_reason

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // ✅ GET LEAVE DETAILS BEFORE UPDATING
    const leaveResult = await pool.query(
      'SELECT * FROM leave_requests WHERE id = $1',
      [leaveId]
    );

    if (leaveResult.rows.length === 0) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    const leaveRequest = leaveResult.rows[0];

    // Update status
    await pool.query(
      `UPDATE leave_requests
       SET status = $1,
           reviewed_by = $2,
           reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [status, req.user.id, leaveId]
    );

    // ✅ SEND EMAIL NOTIFICATION
    if (status === 'APPROVED') {
      await emailService.sendLeaveApprovedEmail(leaveRequest.user_id, leaveRequest);
      
      // Also create notification
      await pool.query(
        `INSERT INTO notifications (user_id, message, is_read, created_at)
         VALUES ($1, $2, false, NOW())`,
        [leaveRequest.user_id, `Your leave request from ${leaveRequest.from_date} to ${leaveRequest.to_date} has been approved.`]
      );
    } else {
      await emailService.sendLeaveRejectedEmail(
        leaveRequest.user_id, 
        leaveRequest, 
        rejection_reason
      );
      
      // Also create notification
      await pool.query(
        `INSERT INTO notifications (user_id, message, is_read, created_at)
         VALUES ($1, $2, false, NOW())`,
        [leaveRequest.user_id, `Your leave request from ${leaveRequest.from_date} to ${leaveRequest.to_date} has been rejected.`]
      );
    }

    res.json({ message: `Leave ${status.toLowerCase()} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};