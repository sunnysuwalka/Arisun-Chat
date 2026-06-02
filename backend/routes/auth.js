const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'vibechat_secret_2024';

module.exports = (db) => {
  const router = express.Router();

  // Generate 6-digit OTP
  const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

  // Send OTP (simulated - in prod use Twilio/AWS SNS)
  router.post('/send-otp', async (req, res) => {
    const { mobile, username, password } = req.body;
    if (!mobile || !username || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // Check if username taken
    if (db.users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Check if mobile taken
    if (db.users.find(u => u.mobile === mobile)) {
      return res.status(400).json({ error: 'Mobile number already registered' });
    }

    const otp = generateOTP();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    db.otps[mobile] = { otp, expires, pendingUser: { username, password, mobile } };

    // In production: send via Twilio
    // For demo: return OTP in response (dev mode)
    console.log(`📱 OTP for ${mobile}: ${otp}`);

    res.json({
      success: true,
      message: `OTP sent to ${mobile}`,
      // Dev mode only - remove in production:
      devOtp: otp
    });
  });

  // Verify OTP & Create Account
  router.post('/register', async (req, res) => {
  const { username, password, mobile } = req.body;

  if (!username || !password || !mobile) {
    return res.status(400).json({ error: 'All fields required' });
  }

  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username taken' });
  }

  if (db.users.find(u => u.mobile === mobile)) {
    return res.status(400).json({ error: 'Mobile already registered' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = {
    id: uuidv4(),
    username,
    password: hashedPassword,
    mobile,
    createdAt: new Date().toISOString(),
    bio: ''
  };

  db.users.push(user);
  db.contacts[user.id] = [];

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  db.sessions[token] = user.id;

  const { password: _, ...safeUser } = user;

  res.json({ success: true, token, user: safeUser });
});

  // Login
  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = db.users.find(u => u.username === username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    db.sessions[token] = user.id;

    const { password: _, ...safeUser } = user;
    res.json({ success: true, token, user: safeUser });
  });

  // Get current user
  router.get('/me', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    try {
      const { userId } = jwt.verify(token, JWT_SECRET);
      const user = db.users.find(u => u.id === userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  return router;
};
