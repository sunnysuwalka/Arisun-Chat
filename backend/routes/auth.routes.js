const router = require('express').Router();
const {
  register,
  verifyEmail,
  login,
  getMe,
  forgotPassword,
  resetPassword
} = require('../controllers/auth.controller');

const auth = require('../middleware/auth');

router.post('/register', register);
router.post('/verify-email', verifyEmail); // 🔥 OTP Route
router.post('/login', login);
router.get('/me', auth, getMe);

// 🔥 Feature #11: Password Recovery Routes
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

module.exports = router;