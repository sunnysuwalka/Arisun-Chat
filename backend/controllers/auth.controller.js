const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id },
    'SECRET_KEY',
    { expiresIn: '30d' }
  );
};

// REGISTER
exports.register = async (req, res) => {
  try {
    const { username, mobile, password } = req.body;

    const exists = await User.findOne({
      $or: [{ username }, { mobile }]
    });

    if (exists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      mobile,
      password: hashed
    });

    res.json({
      token: generateToken(user),
      user
    });

  } catch (err) {
    res.status(500).json({ error: 'Register failed' });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ error: 'Wrong password' });
    }

    res.json({
      token: generateToken(user),
      user
    });

  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
};

// GET ME
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
};