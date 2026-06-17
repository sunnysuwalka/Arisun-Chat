const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Secure this route!
const { generateToken } = require('../controllers/call.controller');

// 🔥 Generate Secure LiveKit Token
router.post('/token', auth, generateToken);

module.exports = router;