const router = require('express').Router();
const {
  register,
  verifyEmail,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  checkAvailability // 🔥 THE FIX: Import the new combined controller
} = require('../controllers/auth.controller');

const auth = require('../middleware/auth');

router.post('/register', register);
router.post('/verify-email', verifyEmail); 
router.post('/login', login);
router.get('/me', auth, getMe);

router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

// 🔥 THE FIX: Using POST instead of GET so data sends securely in the body
router.post('/check-availability', checkAvailability); 

module.exports = router;