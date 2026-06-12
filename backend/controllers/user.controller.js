const User = require('../models/User');
const Request = require('../models/Request');
const bcrypt = require('bcryptjs');

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

// ✏️ UPDATE PROFILE (Standard info without email change)
exports.updateProfile = async (req, res) => {
  try {
    // 🔥 Removed 'mobile' here. Email handles its own OTP flow below.
    const { username, avatar } = req.body; 
    
    const updateData = {};
    if (username) updateData.username = username;
    if (avatar) updateData.avatar = avatar;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true } 
    ).select('-password'); 

    res.status(200).json({ user: updatedUser });
  } catch (err) {
    console.error("Profile Update Error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

// 🔒 UPDATE PASSWORD
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error("Password Update Error:", err);
    res.status(500).json({ error: "Failed to update password" });
  }
};

// 🔥 NEW: REQUEST EMAIL CHANGE (Send OTP)
exports.requestEmailChange = async (req, res) => {
  try {
    const { newEmail } = req.body;
    const cleanEmail = newEmail.trim().toLowerCase();

    // Ensure the new email isn't already taken by another user
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    const user = await User.findById(req.user.id);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save();

    // Fire off the Brevo native fetch
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_USER, name: "Arisun Chat" },
        to: [{ email: cleanEmail }],
        subject: "Arisun Chat — Verify Your New Email",
        htmlContent: `
          <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #1C1C2E;">
            <h2 style="color: #007AFF;">Email Update Request</h2>
            <p>You requested to change your Arisun account email. Please use the verification code below:</p>
            <div style="background-color: #F5F7FB; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h1 style="letter-spacing: 5px; margin: 0; color: #1C1C2E;">${otp}</h1>
            </div>
            <p style="font-size: 14px; color: #666;">This code will expire in 15 minutes.</p>
            <p style="font-size: 14px; color: #666;">If you did not request this, please safely ignore this message.</p>
          </div>
        `
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("BREVO API ERROR:", errorData);
      throw new Error("Failed to send OTP via Brevo");
    }

    res.json({ message: 'OTP sent to new email' });
  } catch (err) {
    console.error("Email Change Request Error:", err);
    res.status(500).json({ error: 'Failed to request email change' });
  }
};

// 🔥 NEW: VERIFY EMAIL CHANGE
exports.verifyEmailChange = async (req, res) => {
  try {
    const { newEmail, otp, username } = req.body;
    const cleanEmail = newEmail.trim().toLowerCase();

    const user = await User.findById(req.user.id);
    
    if (!user.otp || user.otp !== otp) return res.status(400).json({ error: 'Invalid OTP code.' });
    if (user.otpExpires < Date.now()) return res.status(400).json({ error: 'OTP has expired. Please try again.' });

    // Update the email (and optionally username if they changed both at once)
    user.email = cleanEmail;
    if (username) user.username = username;
    
    // Wipe the OTP fields
    user.otp = undefined;
    user.otpExpires = undefined;
    
    await user.save();

    const updatedUser = await User.findById(req.user.id).select('-password');
    res.status(200).json({ user: updatedUser });
  } catch (err) {
    console.error("Verify Email Change Error:", err);
    res.status(500).json({ error: 'Verification failed' });
  }
};