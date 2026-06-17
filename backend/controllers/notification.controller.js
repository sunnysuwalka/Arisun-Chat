const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    // 🔥 FIX 2: .populate('sender') fetches the LIVE avatar directly from the User collection
    const notifications = await Notification.find({ recipient: req.user.id })
      .populate('sender', 'username avatar') 
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// 🔥 FIX 1: New endpoint to fetch active sent requests to survive page refreshes
exports.getSentRequests = async (req, res) => {
  try {
    const sent = await Notification.find({ sender: req.user.id, status: 'pending' }).select('recipient');
    // Map it to a simple array of IDs
    res.json(sent.map(notif => notif.recipient));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sent requests' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

exports.updateRequestStatus = async (req, res) => {
  try {
    const { status } = req.body; 
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { status: status, isRead: true },
      { new: true }
    );
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update request status' });
  }
};