const pool = require("../config/db");


// Admin: create project
exports.createProject = async (req, res) => {
  try {
    const { project_name, description, team_lead_id } = req.body;

    // 🔐 VALIDATION
    if (!project_name || !team_lead_id) {
      return res.status(400).json({
        message: "Project name and Team Lead are required"
      });
    }

    await pool.query(
      `
      INSERT INTO projects (project_name, description, assigned_to, status)
      VALUES ($1, $2, $3, 'ASSIGNED')
      `,
      [project_name, description || null, Number(team_lead_id)]
    );

    res.json({ message: "Project created successfully" });
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// Team Lead: view assigned projects
exports.getTeamLeadProjects = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT * FROM projects
      WHERE assigned_to = $1
      `,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Team Lead: assign members
exports.assignMembersToProject = async (req, res) => {
  try {
    const { project_id, member_ids } = req.body;

    // Verify project belongs to this team lead
    const projectCheck = await pool.query(
      "SELECT id FROM projects WHERE id = $1 AND assigned_to = $2",
      [project_id, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(403).json({ message: "Not authorized" });
    }

    for (const memberId of member_ids) {
      await pool.query(
        `
        INSERT INTO project_members (project_id, member_id, selected_by)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        `,
        [project_id, memberId, req.user.id]
      );
    }

    res.json({ message: "Members assigned successfully" });

  } catch (err) {
    console.error("Assign members error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Team Lead: view project members
exports.getProjectMembers = async (req, res) => {
  try {
    const { project_id } = req.params;

    const result = await pool.query(
      `
      SELECT u.id, u.user_id, u.name, u.email, u.domain
      FROM project_members pm
      JOIN users u ON pm.member_id = u.id
      WHERE pm.project_id = $1
      `,
      [project_id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Team Lead: create roadmap
// Team Lead: create roadmap (original version)
exports.createRoadmap = async (req, res) => {
  try {
    const { project_id, steps } = req.body;
    const userId = req.user.id;

    if (!project_id || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ message: "Invalid roadmap data" });
    }

    // Verify project belongs to this team lead
    const projectCheck = await pool.query(
      `
      SELECT id
      FROM projects
      WHERE id = $1
        AND assigned_to = $2
      `,
      [project_id, userId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(403).json({ message: "Not authorized for this project" });
    }

    // Create roadmap (new one every time)
    const roadmapResult = await pool.query(
      `
      INSERT INTO roadmaps (project_id, created_by)
      VALUES ($1, $2)
      RETURNING id
      `,
      [project_id, userId]
    );

    const roadmapId = roadmapResult.rows[0].id;

    // Insert steps
    for (const step of steps) {
      await pool.query(
        `
        INSERT INTO roadmap_steps (roadmap_id, step_title)
        VALUES ($1, $2)
        `,
        [roadmapId, step]
      );
    }

    res.json({ message: "Roadmap created successfully" });

  } catch (err) {
    console.error("Create roadmap error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Team Lead / Member: update roadmap step status
exports.updateRoadmapStep = async (req, res) => {
  try {
    const { step_id, is_completed } = req.body;

    await pool.query(
      `
      UPDATE roadmap_steps
      SET 
        is_completed = $1,
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      `,
      [is_completed, req.user.id, step_id]
    );

    res.json({ message: "Roadmap step updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
// Admin: view roadmap progress for a project
exports.getRoadmapProgress = async (req, res) => {
  try {
    const { project_id } = req.params;

    const stepsResult = await pool.query(
      `
      SELECT 
        rs.id,
        rs.step_title,
        rs.is_completed,
        u.name AS updated_by,
        rs.updated_at
      FROM roadmap_steps rs
      JOIN roadmaps r ON rs.roadmap_id = r.id
      LEFT JOIN users u ON rs.updated_by = u.id
      WHERE r.project_id = $1
      ORDER BY rs.id
      `,
      [project_id]
    );

    // ✅ STEP 2 FIX: handle NO roadmap / NO steps clearly
    if (stepsResult.rows.length === 0) {
      return res.json({
        progress: "0%",
        steps: [],
        message: "No roadmap created yet"
      });
    }

    const total = stepsResult.rows.length;
    const completed = stepsResult.rows.filter(
      step => step.is_completed
    ).length;

    const progress = Math.round((completed / total) * 100);

    res.json({
      progress: `${progress}%`,
      steps: stepsResult.rows
    });

  } catch (err) {
    console.error("Get roadmap progress error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllProjects = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, project_name
      FROM projects
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Get all projects error:", err);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
};
// Team Lead: view roadmap for assigned project
exports.getLeadRoadmap = async (req, res) => {
  try {
    const projectId = req.params.project_id;
    const userId = req.user.id;

    console.log("JWT USER 👉", req.user);
    console.log("PROJECT ID 👉", projectId);

    // 1️⃣ Verify project belongs to this team lead
    const projectCheck = await pool.query(
      `
      SELECT id
      FROM projects
      WHERE id = $1
        AND assigned_to = $2
      `,
      [projectId, userId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(403).json({ message: "Not authorized for this project" });
    }

    // 2️⃣ Load roadmap steps
    const stepsResult = await pool.query(
      `
      SELECT 
        rs.id,
        rs.step_title,
        rs.is_completed,
        u.name AS updated_by,
        rs.updated_at
      FROM roadmap_steps rs
      JOIN roadmaps r ON rs.roadmap_id = r.id
      LEFT JOIN users u ON rs.updated_by = u.id
      WHERE r.project_id = $1
      ORDER BY rs.id
      `,
      [projectId]
    );

    const total = stepsResult.rows.length;
    const completed = stepsResult.rows.filter(s => s.is_completed).length;

    const progress =
      total === 0 ? "0%" : `${Math.round((completed / total) * 100)}%`;

    res.json({
      progress,
      steps: stepsResult.rows
    });

  } catch (err) {
    console.error("Lead roadmap error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================= DELETE PROJECT (ADMIN) =================
exports.deleteProject = async (req, res) => {
  const client = await pool.connect();

  try {
    const projectId = req.params.id;

    await client.query("BEGIN");

    // Check project exists
    const projectCheck = await client.query(
      `SELECT id FROM projects WHERE id = $1`,
      [projectId]
    );

    if (projectCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Project not found" });
    }

    // Delete project members
    await client.query(
      `DELETE FROM project_members WHERE project_id = $1`,
      [projectId]
    );

    // Delete roadmap steps
    await client.query(`
      DELETE FROM roadmap_steps
      WHERE roadmap_id IN (
        SELECT id FROM roadmaps WHERE project_id = $1
      )
    `, [projectId]);

    // Delete roadmap
    await client.query(
      `DELETE FROM roadmaps WHERE project_id = $1`,
      [projectId]
    );

    // Delete project
    await client.query(
      `DELETE FROM projects WHERE id = $1`,
      [projectId]
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
exports.getProjectWithMembers = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Project + Team Lead
    const projectResult = await pool.query(
      `
      SELECT 
        p.id,
        p.project_name,
        u.id AS team_lead_id,
        u.name AS team_lead_name,
        u.user_id AS team_lead_code
      FROM projects p
      JOIN users u ON u.id = p.assigned_to
      WHERE p.id = $1
      `,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Only MEMBERS (not team lead)
    const membersResult = await pool.query(
      `
      SELECT 
        u.id,
        u.user_id,
        u.name,
        u.email,
        u.domain
      FROM project_members pm
      JOIN users u ON u.id = pm.member_id
      WHERE pm.project_id = $1
        AND u.role = 'MEMBER'
      ORDER BY u.name
      `,
      [projectId]
    );

    res.json({
      project: projectResult.rows[0],
      members: membersResult.rows
    });

  } catch (err) {
    console.error("Admin project members error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
// Team Lead: get all members (multi-project allowed)
exports.getAllMembersForLead = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        user_id,
        name,
        email,
        domain
      FROM users
      WHERE role = 'MEMBER'
      ORDER BY name
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Get members for lead error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
// Member: get all assigned project roadmaps

// MEMBER: get assigned project
// MEMBER: get roadmap for assigned project
exports.getMemberRoadmaps = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT
        p.id AS project_id,
        p.project_name,
        rs.id AS step_id,
        rs.step_title,
        rs.is_completed
      FROM project_members pm
      JOIN projects p ON p.id = pm.project_id
      LEFT JOIN roadmaps r ON r.project_id = p.id
      LEFT JOIN roadmap_steps rs ON rs.roadmap_id = r.id
      WHERE pm.member_id = $1
      ORDER BY p.id, rs.id
    `, [userId]);

    if (result.rows.length === 0) {
      return res.json([]);
    }

    const projects = {};

    result.rows.forEach(row => {
      if (!projects[row.project_id]) {
        projects[row.project_id] = {
          project_id: row.project_id,
          project_name: row.project_name,
          steps: []
        };
      }

      if (row.step_id) {
        projects[row.project_id].steps.push({
          id: row.step_id,
          step_title: row.step_title,
          is_completed: row.is_completed
        });
      }
    });

    res.json(Object.values(projects));

  } catch (err) {
    console.error("Member roadmap error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
