const pool = require("../config/db");
const emailService = require('../services/emailService');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      role: user.role,
      user_id: user.user_id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================================
// CHANGE PASSWORD  (requires valid JWT — works for all roles)
// ============================================================
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Basic validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both fields are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    // Fetch user
    const result = await pool.query(
      "SELECT id, password FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 10);

    // Save
    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashed, userId]
    );

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("changePassword error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.register = async (req, res) => {
  try {
    const { user_id, name, email, role } = req.body;

    // ... existing validation ...

    // Generate temporary password
    const temporaryPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const result = await pool.query(
      `INSERT INTO users (user_id, name, email, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [user_id, name, email, hashedPassword, role]
    );

    const newUserId = result.rows[0].id;

    // ✅ SEND WELCOME EMAIL WITH CREDENTIALS
    await emailService.sendWelcomeEmail(newUserId, temporaryPassword);

    res.json({
      message: "User registered successfully. Welcome email sent.",
      temporary_password: temporaryPassword // Only show in development
    });

  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: "Server error" });
  }
};