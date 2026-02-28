const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const testController = require('../controllers/testController');

router.post('/send-test-email', verifyToken, isAdmin, testController.testEmail);

module.exports = router;