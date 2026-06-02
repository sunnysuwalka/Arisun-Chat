const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'vibechat_secret_2024';

const authenticate = (db) => (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { userId } = jwt.verify(token, JWT_SECRET);
    req.userId = userId;
    req.user = db.users.find(u => u.id === userId);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = (db) => {
  const router = express.Router();
  const auth = authenticate(db);

  // Search users by username
  router.get('/search', auth, (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const myContacts = db.contacts[req.userId] || [];
    const myRequests = db.requests.filter(r =>
      (r.from === req.userId || r.to === req.userId) && r.status === 'pending'
    );

    const results = db.users
      .filter(u =>
        u.id !== req.userId &&
        u.username.toLowerCase().includes(q.toLowerCase())
      )
      .map(u => {
        const { password: _, ...safe } = u;
        const isContact = myContacts.includes(u.id);
        const pendingRequest = myRequests.find(r => r.from === req.userId && r.to === u.id);
        const incomingRequest = myRequests.find(r => r.from === u.id && r.to === req.userId);
        return {
          ...safe,
          isContact,
          requestSent: !!pendingRequest,
          requestId: pendingRequest?.id || incomingRequest?.id || null,
          requestReceived: !!incomingRequest,
        };
      })
      .slice(0, 20);

    res.json(results);
  });

  // Send friend request
  router.post('/request', auth, (req, res) => {
    const { toUserId } = req.body;
    const toUser = db.users.find(u => u.id === toUserId);
    if (!toUser) return res.status(404).json({ error: 'User not found' });

    const existing = db.requests.find(r =>
      ((r.from === req.userId && r.to === toUserId) ||
       (r.from === toUserId && r.to === req.userId)) &&
      r.status === 'pending'
    );
    if (existing) return res.status(400).json({ error: 'Request already exists' });

    const contacts = db.contacts[req.userId] || [];
    if (contacts.includes(toUserId)) {
      return res.status(400).json({ error: 'Already in contacts' });
    }

    const request = {
      id: uuidv4(),
      from: req.userId,
      to: toUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      fromUser: (() => { const { password: _, ...s } = req.user; return s; })(),
    };
    db.requests.push(request);
    res.json({ success: true, request });
  });

  // Get pending requests (incoming)
  router.get('/requests', auth, (req, res) => {
    const incoming = db.requests
      .filter(r => r.to === req.userId && r.status === 'pending')
      .map(r => {
        const fromUser = db.users.find(u => u.id === r.from);
        const { password: _, ...safe } = fromUser || {};
        return { ...r, fromUser: safe };
      });
    res.json(incoming);
  });

  // Accept / Decline request
  router.put('/request/:id', auth, (req, res) => {
    const { action } = req.body; // 'accept' or 'decline'
    const request = db.requests.find(r => r.id === req.params.id && r.to === req.userId);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    request.status = action === 'accept' ? 'accepted' : 'declined';

    if (action === 'accept') {
      if (!db.contacts[req.userId]) db.contacts[req.userId] = [];
      if (!db.contacts[request.from]) db.contacts[request.from] = [];
      db.contacts[req.userId].push(request.from);
      db.contacts[request.from].push(req.userId);
    }

    res.json({ success: true, request });
  });

  // Get contacts (inbox)
  router.get('/contacts', auth, (req, res) => {
    const contactIds = db.contacts[req.userId] || [];
    const contacts = contactIds.map(id => {
      const user = db.users.find(u => u.id === id);
      if (!user) return null;
      const { password: _, ...safe } = user;
      // Get last message
      const roomId = [req.userId, id].sort().join('_');
      const msgs = db.messages[roomId] || [];
      const lastMsg = msgs[msgs.length - 1] || null;
      return { ...safe, lastMessage: lastMsg, roomId };
    }).filter(Boolean);
    res.json(contacts);
  });

  // Get user profile
  router.get('/:id', auth, (req, res) => {
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...safe } = user;
    res.json(safe);
  });

  return router;
};
