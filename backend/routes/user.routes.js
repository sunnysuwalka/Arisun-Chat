const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  searchUsers, sendRequest, getRequests, handleRequest, getContacts,
  blockUser, unblockUser, removeFriend, updateProfile, updatePassword,
  requestEmailChange, verifyEmailChange // 🔥 Added new controllers
} = require('../controllers/user.controller');

router.get('/search', auth, searchUsers);
router.post('/request', auth, sendRequest);
router.get('/requests', auth, getRequests);
router.put('/request/:id', auth, handleRequest);
router.get('/contacts', auth, getContacts);
router.post('/block', auth, blockUser);
router.post('/remove', auth, removeFriend);
router.post('/unblock', auth, unblockUser);

// Profile Endpoints
router.put('/profile', auth, updateProfile);
router.put('/password', auth, updatePassword);

// 🔥 NEW: Email Change Endpoints
router.post('/request-email-change', auth, requestEmailChange);
router.post('/verify-email-change', auth, verifyEmailChange);

module.exports = router;