const mongoose = require('mongoose');

const inboxSchema = new mongoose.Schema({
  users: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  ],

  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },

  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }

}, { timestamps: true });

module.exports = mongoose.model('Inbox', inboxSchema);