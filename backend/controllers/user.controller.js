const User = require('../models/User');
const Request = require('../models/Request');

// 🔍 SEARCH
exports.searchUsers = async (req, res) => {
  try {
    const q = req.query.q || '';
    const users = await User.find({
      username: { $regex: q, $options: 'i' },
      _id: { $ne: req.user.id }
    }).select('-password');
    res.json(users);
  } catch { res.status(500).json({ error: 'Search failed' }); }
};

// 🤝 SEND REQUEST
exports.sendRequest = async (req, res) => {
  try {
    const { toUserId } = req.body;
    const fromUserId = req.user.id;
    if (toUserId === fromUserId) return res.status(400).json({ error: 'Invalid' });

    const target = await User.findById(toUserId);
    if (target.blockedUsers.includes(fromUserId)) return res.status(403).json({ error: 'Blocked' });

    const exists = await Request.findOne({ from: fromUserId, to: toUserId, status: 'pending' });
    if (exists) return res.status(400).json({ error: 'Already sent' });

    const request = await Request.create({ from: fromUserId, to: toUserId });
    res.json({ request });
  } catch { res.status(500).json({ error: 'Failed' }); }
};

// 📥 GET REQUESTS
exports.getRequests = async (req, res) => {
  try {
    const requests = await Request.find({ to: req.user.id, status: 'pending' }).populate('from', 'username avatar');
    res.json(requests);
  } catch { res.status(500).json({ error: 'Failed' }); }
};

// ✅ ACCEPT / ❌ DECLINE
exports.handleRequest = async (req, res) => {
  try {
    const { action } = req.body;
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Not found' });

    if (action === 'accept') {
      request.status = 'accepted';
      await User.findByIdAndUpdate(request.from, { $addToSet: { friends: request.to } });
      await User.findByIdAndUpdate(request.to, { $addToSet: { friends: request.from } });
    } else {
      request.status = 'declined';
    }
    await request.save();
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
};

// 👥 GET CONTACTS
exports.getContacts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('friends', 'username avatar');
    res.json(user.friends);
  } catch { res.status(500).json({ error: 'Failed' }); }
};

// 🚫 BLOCK USER
exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.body;
    const myId = req.user.id;
    await User.findByIdAndUpdate(myId, { $addToSet: { blockedUsers: userId }, $pull: { friends: userId } });
    await User.findByIdAndUpdate(userId, { $pull: { friends: myId } });
    res.json({ message: 'User blocked' });
  } catch { res.status(500).json({ error: 'Block failed' }); }
};

// ❌ REMOVE FRIEND
exports.removeFriend = async (req, res) => {
  try {
    const { userId } = req.body;
    const myId = req.user.id;
    await User.findByIdAndUpdate(myId, { $pull: { friends: userId } });
    await User.findByIdAndUpdate(userId, { $pull: { friends: myId } });
    res.json({ message: 'Friend removed' });
  } catch { res.status(500).json({ error: 'Remove failed' }); }
};

// 🔓 UNBLOCK
exports.unblockUser = async (req, res) => {
  try {
    const { userId } = req.body;
    await User.findByIdAndUpdate(req.user.id, { $pull: { blockedUsers: userId } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Unblock failed' }); }
};