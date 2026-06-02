const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  roomId: String,

  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  type: {
    type: String,
    enum: ['audio', 'video']
  },

  status: {
    type: String,
    enum: ['missed', 'completed', 'rejected'],
    default: 'missed'
  },

  duration: Number // in seconds

}, { timestamps: true });

module.exports = mongoose.model('Call', callSchema);