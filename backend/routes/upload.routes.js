const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const protect = require('../middleware/auth'); 
const User = require('../models/User');


// --- 1. CHAT ATTACHMENT ROUTE ---
router.post('/file', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error("\n❌ [FILE MIDDLEWARE CRASH] Exact Error:", JSON.stringify(err, null, 2));
      return res.status(500).json({ message: 'Upload Middleware Error', error: err.message });
    }
    next(); 
  });
}, (req, res) => {
  console.log("\n📂 [FILE UPLOAD] Successfully passed middleware!");
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    console.log("✅ [FILE SUCCESS] Live URL:", req.file.path);
    res.status(200).json({ 
      url: req.file.path,
      type: req.file.mimetype.split('/')[0] 
    }); 
  } catch (error) {
    res.status(500).json({ message: 'Upload logic failed', error: error.message });
  }
});

// --- 2. PROFILE AVATAR ROUTE ---
// --- 2. PROFILE AVATAR ROUTE ---
// 🔥 Added 'protect' so we know whose profile to update
router.post('/avatar', protect, (req, res, next) => { 
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      console.error("\n❌ [AVATAR MIDDLEWARE CRASH]", err);
      return res.status(500).json({ message: 'Avatar Upload Error', error: err.message });
    }
    next(); 
  });
}, async (req, res) => { // 🔥 Made this async
  console.log("\n👤 [AVATAR UPLOAD] Successfully passed middleware!");
  try {
    if (!req.file) return res.status(400).json({ message: 'No avatar provided' });
    console.log("✅ [AVATAR SUCCESS] Live URL:", req.file.path);
    
    // 🔥 THE FIX: Update the database!
    // Note: Change 'profilePic' to whatever the field is called in your User schema (e.g., 'pic', 'avatar')
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id, 
      { profilePic: req.file.path }, 
      { new: true }
    ).select('-password');

    res.status(200).json({ 
      url: req.file.path,
      user: updatedUser // Send the updated user back to the frontend
    }); 
  } catch (error) {
    res.status(500).json({ message: 'Avatar upload failed', error: error.message });
  }
});


module.exports = router;