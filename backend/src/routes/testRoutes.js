const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const testController = require('../controllers/testController');

router.post('/send-test-email', auth, testController.testEmail);

module.exports = router;