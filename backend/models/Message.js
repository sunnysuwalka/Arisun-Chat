const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: { type: String, index: true },

  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  type: {
    type: String,
    enum: ['text', 'image', 'video', 'file', 'audio', 'call_log'],
    default: 'text'
  },

  text: String,
  url: String,

  seen: { type: Boolean, default: false },
  seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  

  inboxId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Inbox'
},

replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },

edited: { type: Boolean, default: false },

reactions: [
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: String
  }
],

}, { timestamps: true });



module.exports = mongoose.model('Message', messageSchema);