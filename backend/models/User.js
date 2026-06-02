const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  mobile: {
    type: String,
    unique: true
  },

  password: {
    type: String,
    required: true
  },

  avatar: {
    type: String,
    default: ''
  },

  friends: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],

  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);