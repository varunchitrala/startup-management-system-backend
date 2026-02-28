const pool = require("../config/db");

const bcrypt = require("bcrypt");
const emailService = require("../services/emailService");

/* ================== CREATE TEAM LEAD ================== */
exports.createTeamLead = async (req, res) => {
  try {
    const { name, email, password, domain } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Generate next TEAM_LEAD user_id (TL001, TL002...)
    const seqResult = await pool.query(
      "SELECT nextval('team_lead_seq')"
    );

    const user_id = `TL${String(seqResult.rows[0].nextval).padStart(3, "0")}`;


    const hashedPassword = await bcrypt.hash(password, 10);

    const insertResult = await pool.query(
      `
      INSERT INTO users (user_id, name, email, password, role, domain)
      VALUES ($1, $2, $3, $4, 'TEAM_LEAD', $5)
      RETURNING id
      `,
      [user_id, name, email, hashedPassword, domain || null]
    );

    await emailService.sendWelcomeEmail(insertResult.rows[0].id, password);

    res.json({
      message: "Team Lead created successfully",
      user_id
    });

  } catch (err) {
    console.error("Create Team Lead error:", err);

    if (err.code === "23505") {
      return res.status(400).json({ message: "Email already exists" });
    }

    res.status(500).json({ message: "Server error" });
  }
};

/* ================== CREATE TEAM MEMBER ================== */
exports.createTeamMember = async (req, res) => {
  try {
    const { name, email, password, domain } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Generate next MEMBER user_id (TM001, TM002...)
    const seqResult = await pool.query(
      "SELECT nextval('team_member_seq')"
    );

    const user_id = `TM${String(seqResult.rows[0].nextval).padStart(3, "0")}`;


    const hashedPassword = await bcrypt.hash(password, 10);

    const insertResult = await pool.query(
      `
      INSERT INTO users (user_id, name, email, password, role, domain)
      VALUES ($1, $2, $3, $4, 'MEMBER', $5)
      RETURNING id
      `,
      [user_id, name, email, hashedPassword, domain || null]
    );

    await emailService.sendWelcomeEmail(insertResult.rows[0].id, password);

    res.json({
      message: "Team Member created successfully",
      user_id
    });

  } catch (err) {
    console.error("Create Team Member error:", err);

    if (err.code === "23505") {
      return res.status(400).json({ message: "Email already exists" });
    }

    res.status(500).json({ message: "Server error" });
  }
};

/* ================== GET TEAM MEMBERS ================== */
exports.getTeamMembers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.user_id,
        u.name,
        u.email,
        u.role,
        u.shift_id,

        CASE
          WHEN u.role = 'TEAM_LEAD' AND EXISTS (
            SELECT 1 FROM projects p WHERE p.assigned_to = u.id
          ) THEN true

          WHEN u.role = 'MEMBER' AND EXISTS (
            SELECT 1 FROM project_members pm WHERE pm.member_id = u.id
          ) THEN true

          ELSE false
        END AS is_assigned

      FROM users u
      WHERE u.role IN ('TEAM_LEAD', 'MEMBER')
      ORDER BY u.role, u.id
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Get team members error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================== SET OFFICE TIMING ================== */

// ================= DELETE TEAM MEMBER (ADMIN) =================
exports.deleteTeamMember = async (req, res) => {
  const client = await pool.connect();

  try {
    const memberId = req.params.id;

    await client.query("BEGIN");

    // Ensure user exists and is MEMBER
    const userCheck = await client.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'MEMBER'`,
      [memberId]
    );

    if (userCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Team member not found" });
    }

    // Remove from project_members
    await client.query(
      `DELETE FROM project_members WHERE member_id = $1`,
      [memberId]
    );

    // Remove attendance records
    await client.query(
      `DELETE FROM attendance WHERE user_id = $1`,
      [memberId]
    );

    // Remove leave requests (if table exists)
    await client.query(
      `DELETE FROM leave_requests WHERE user_id = $1`,
      [memberId]
    );

    // Finally delete user
    await client.query(
      `DELETE FROM users WHERE id = $1`,
      [memberId]
    );

    await client.query("COMMIT");

    res.json({ message: "Team member deleted successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete team member error:", err);
    res.status(500).json({ message: "Server error while deleting member" });
  } finally {
    client.release();
  }
};
// ================= DELETE TEAM LEAD (ADMIN) =================
exports.deleteTeamLead = async (req, res) => {
  const client = await pool.connect();

  try {
    const leadId = req.params.id;

    await client.query("BEGIN");

    // Ensure user exists and is TEAM_LEAD
    const userCheck = await client.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'TEAM_LEAD'`,
      [leadId]
    );

    if (userCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Team lead not found" });
    }

    // Check if projects are assigned
    const projectCheck = await client.query(
      `SELECT id FROM projects WHERE assigned_to = $1`,
      [leadId]
    );

    if (projectCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Cannot delete team lead with active projects. Reassign or delete projects first."
      });
    }

    // Delete attendance
    await client.query(
      `DELETE FROM attendance WHERE user_id = $1`,
      [leadId]
    );

    // Delete leave requests
    await client.query(
      `DELETE FROM leave_requests WHERE user_id = $1`,
      [leadId]
    );

    // Delete user
    await client.query(
      `DELETE FROM users WHERE id = $1`,
      [leadId]
    );

    await client.query("COMMIT");

    res.json({ message: "Team lead deleted successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete team lead error:", err);
    res.status(500).json({ message: "Server error while deleting team lead" });
  } finally {
    client.release();
  }
};
exports.getProjectMembersForAdmin = async (req, res) => {
  try {
    const { project_id } = req.params;

    /* ================= PROJECT + TEAM LEAD ================= */
    const projectResult = await pool.query(
      `
      SELECT 
        p.id,
        p.project_name,
        u.name AS team_lead_name,
        u.user_id AS team_lead_code
      FROM projects p
      JOIN users u ON u.id = p.assigned_to
      WHERE p.id = $1
      `,
      [project_id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    /* ================= ASSIGNED MEMBERS ================= */
    const membersResult = await pool.query(
      `
      SELECT 
        m.id,
        m.user_id,
        m.name,
        m.email,
        m.domain
      FROM project_members pm
      JOIN users m ON m.id = pm.member_id
      WHERE pm.project_id = $1
      ORDER BY m.name
      `,
      [project_id]
    );

    /* ================= FINAL RESPONSE ================= */
    res.json({
      project: {
        team_lead_name: projectResult.rows[0].team_lead_name,
        team_lead_code: projectResult.rows[0].team_lead_code
      },
      members: membersResult.rows
    });

  } catch (err) {
    console.error("Admin project members error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ================= REMOVE MEMBER FROM PROJECT (ADMIN) =================
exports.removeMemberFromProject = async (req, res) => {
  const client = await pool.connect();

  try {
    const { project_id, member_id } = req.params;

    await client.query("BEGIN");

    // Check membership exists
    const check = await client.query(
      `
      SELECT 1
      FROM project_members
      WHERE project_id = $1 AND member_id = $2
      `,
      [project_id, member_id]
    );

    if (check.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Member not assigned to this project" });
    }

    // Delete mapping
    await client.query(
      `
      DELETE FROM project_members
      WHERE project_id = $1 AND member_id = $2
      `,
      [project_id, member_id]
    );

    await client.query("COMMIT");

    res.json({ message: "Member removed from project successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Remove member error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};
// ================= DELETE PROJECT (ADMIN) =================
exports.deleteProject = async (req, res) => {
  const client = await pool.connect();

  try {
    const { project_id } = req.params;

    await client.query("BEGIN");

    // Check project exists
    const projectCheck = await client.query(
      `SELECT id FROM projects WHERE id = $1`,
      [project_id]
    );

    if (projectCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Project not found" });
    }

    // Remove project members
    await client.query(
      `DELETE FROM project_members WHERE project_id = $1`,
      [project_id]
    );

    // Remove roadmap steps
    await client.query(
      `
      DELETE FROM roadmap_steps
      WHERE roadmap_id IN (
        SELECT id FROM roadmaps WHERE project_id = $1
      )
      `,
      [project_id]
    );

    // Remove roadmap
    await client.query(
      `DELETE FROM roadmaps WHERE project_id = $1`,
      [project_id]
    );

    // Delete project
    await client.query(
      `DELETE FROM projects WHERE id = $1`,
      [project_id]
    );

    await client.query("COMMIT");

    res.json({ message: "Project deleted successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete project error:", err);
    res.status(500).json({ message: "Server error while deleting project" });
  } finally {
    client.release();
  }
};

exports.assignShiftToUser = async (req, res) => {
  try {
    const { user_id, shift_id } = req.body;

    if (!user_id || !shift_id) {
      return res.status(400).json({ message: "User and shift required" });
    }

    await pool.query(
      `UPDATE users SET shift_id = $1 WHERE id = $2`,
      [shift_id, user_id]
    );

    res.json({ message: "Shift assigned successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


// ================= GET ALL TEAM LEADS (ADMIN) =================
exports.getAllTeamLeads = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, user_id, name
      FROM users
      WHERE role = 'TEAM_LEAD'
      ORDER BY id
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Get team leads error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.autoCreateTodayAttendance = async () => {
  try {
    // Get all active users except ADMIN
    const users = await pool.query(`
      SELECT id, shift_id
      FROM users
      WHERE role != 'ADMIN'
    `);

    for (const user of users.rows) {
      await pool.query(`
        INSERT INTO attendance (user_id, date, status)
        VALUES ($1, CURRENT_DATE, 'ABSENT')
        ON CONFLICT (user_id, date) DO NOTHING
      `, [user.id]);
    }

    console.log("✅ Today attendance auto-created");

  } catch (err) {
    console.error("❌ Auto attendance error:", err);
  }
};
exports.getAllLeaveRequests = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        lr.id,
        u.user_id,
        u.name,
        u.role,
        lr.from_date,
        lr.to_date,
        lr.reason,
        lr.status,
        lr.applied_at,
        lr.reviewed_at
      FROM leave_requests lr
      JOIN users u ON u.id = lr.user_id
      ORDER BY lr.applied_at DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Get leave error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.reviewLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    await pool.query(
      `UPDATE leave_requests
       SET status = $1, reviewed_at = NOW(), reviewed_by = $2
       WHERE id = $3`,
      [status, req.user.id, id]
    );

    // Fetch leave + user details for notification and attendance
    const leave = await pool.query(
      `SELECT lr.user_id, lr.from_date, lr.to_date
       FROM leave_requests lr WHERE lr.id = $1`,
      [id]
    );

    if (leave.rows.length > 0) {
      const { user_id, from_date, to_date } = leave.rows[0];

      // 🔔 Notify the user of the decision
      const emoji = status === "APPROVED" ? "✅" : "❌";
      const notifMessage = `${emoji} Your leave request (${from_date} → ${to_date}) has been ${status} by Admin.`;

      await pool.query(
        `INSERT INTO notifications (user_id, message, is_read, created_at)
         VALUES ($1, $2, false, NOW())
         ON CONFLICT ON CONSTRAINT uniq_notification_per_user_per_day DO NOTHING`,
        [user_id, notifMessage]
      );

      // If APPROVED — mark attendance as ON_LEAVE for those days
      if (status === "APPROVED") {
        await pool.query(`
          INSERT INTO attendance (user_id, date, status)
          SELECT $1, d::date, 'ON_LEAVE'
          FROM generate_series($2::date, $3::date, interval '1 day') d
          WHERE NOT EXISTS (
            SELECT 1 FROM attendance a
            WHERE a.user_id = $1 AND a.date = d::date
          )
        `, [user_id, from_date, to_date]);

        await emailService.sendLeaveApprovedEmail(user_id, leave.rows[0]);
      } else {
        await emailService.sendLeaveRejectedEmail(user_id, leave.rows[0], req.body.rejection_reason);
      }
    }

    res.json({ message: `Leave ${status}` });

  } catch (err) {
    console.error("Review leave error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================== BROADCAST ANNOUNCEMENT ================== */
exports.broadcastAnnouncement = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Announcement message is required" });
    }

    const users = await pool.query(`SELECT id FROM users`);

    if (users.rows.length === 0) {
      return res.json({ message: "No users to notify", sent: 0 });
    }

    const text = `📢 Admin Announcement: ${message.trim()}`;

    // Insert one notification per user (simple, safe, works on all PG versions)
    for (const user of users.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, message, is_read, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT ON CONSTRAINT uniq_notification_per_user_per_day DO NOTHING`,
        [user.id, text, false]
      );
    }

    res.json({ message: `Announcement sent to ${users.rows.length} users`, sent: users.rows.length });

  } catch (err) {
    console.error("Broadcast announcement error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
