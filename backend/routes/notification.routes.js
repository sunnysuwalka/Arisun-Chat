const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth'); 
const { getNotifications, getSentRequests, markAsRead, updateRequestStatus } = require('../controllers/notification.controller');

router.get('/', protect, getNotifications);
router.get('/sent', protect, getSentRequests); // 🔥 MUST BE HERE
router.put('/:id/read', protect, markAsRead);
router.put('/:id/action', protect, updateRequestStatus);

module.exports = router;