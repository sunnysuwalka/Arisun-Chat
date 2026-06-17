const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderUsername: { type: String, required: true },
  senderAvatar: { type: String, default: null },
  type: { type: String, enum: ['FRIEND_REQUEST', 'SYSTEM'], default: 'FRIEND_REQUEST' },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);