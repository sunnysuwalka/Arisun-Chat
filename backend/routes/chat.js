const express = require('express');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'vibechat_secret_2024';

const authenticate = (db) => (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { userId } = jwt.verify(token, JWT_SECRET);
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = (db) => {
  const router = express.Router();
  const auth = authenticate(db);

  // Get messages for a room
  router.get('/:roomId', auth, (req, res) => {
    const { roomId } = req.params;
    // Verify user is in this room
    const [uid1, uid2] = roomId.split('_');
    const contacts = db.contacts[req.userId] || [];
    const otherUserId = uid1 === req.userId ? uid2 : uid1;
    if (!contacts.includes(otherUserId)) {
      return res.status(403).json({ error: 'Not authorized for this room' });
    }
    const messages = db.messages[roomId] || [];
    res.json(messages);
  });

  return router;
};
