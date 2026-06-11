const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
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
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // 🔥 E2EE MULTI-DEVICE VAULT FIELDS
  publicKey: {
    type: String // Curve25519 public key for encryption
  },
  signPublicKey: {
    type: String // Ed25519 public key for verifying signatures
  },
  primaryVault: {
    type: String // Private keys locked with the user's raw login password
  },
  recoveryVault: {
    type: String // Private keys locked with the generated 16-char Recovery Phrase
  },

  // OTP Verification Fields
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    type: String
  },
  otpExpires: {
    type: Date
  },

  // Password Recovery Tokens
  resetPasswordToken: String,
  resetPasswordExpires: Date

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);