const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");

const {
  getMyNotifications,
  markAsRead,
  markAllRead
} = require("../controllers/notificationController");

router.get("/my-notifications", verifyToken, getMyNotifications);
// ⚠️ /read-all MUST come before /:id/read so Express doesn't treat "read-all" as an ID
router.patch("/read-all", verifyToken, markAllRead);
router.patch("/:id/read", verifyToken, markAsRead);

module.exports = router;

