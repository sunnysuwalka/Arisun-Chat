const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  }

}, { timestamps: true });

module.exports = mongoose.model('Request', requestSchema);