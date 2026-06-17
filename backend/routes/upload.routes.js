const express = require('express');
const router = express.Router();
const { upload, cloudinary } = require('../config/cloudinary');
const protect = require('../middleware/auth'); 
const User = require('../models/User');

// --- 1. CHAT ATTACHMENT & GROUP AVATAR ROUTE ---
router.post('/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    console.log("🚀 [UPLOAD] Streaming file directly to Cloudinary...");
    
    // Direct pipe to Cloudinary
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'arisun_chat', resource_type: 'auto' },
      (error, result) => {
        if (error) {
          console.error("❌ [CLOUDINARY ERROR]", error);
          return res.status(500).json({ error: 'Cloudinary rejected the file' });
        }
        
        console.log("✅ [SUCCESS] Cloudinary URL acquired:", result.secure_url);
        
        // Hand the URL directly back to the React frontend
        res.status(200).json({ 
          url: result.secure_url,
          type: req.file.mimetype ? req.file.mimetype.split('/')[0] : 'unknown'
        });
      }
    );
    
    // Execute the stream from Node's RAM
    stream.end(req.file.buffer);
    
  } catch (error) {
    res.status(500).json({ message: 'Upload logic failed', error: error.message });
  }
});

// --- 2. PROFILE AVATAR ROUTE ---
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => { 
  try {
    if (!req.file) return res.status(400).json({ message: 'No avatar provided' });

    console.log("👤 [AVATAR] Streaming directly to Cloudinary...");

    const stream = cloudinary.uploader.upload_stream(
      { folder: 'arisun_chat', resource_type: 'auto' },
      async (error, result) => {
        if (error) return res.status(500).json({ error: 'Cloudinary rejected the file' });
        
        console.log("✅ [AVATAR SUCCESS] Updating Database with:", result.secure_url);

        // Update Database
        const updatedUser = await User.findByIdAndUpdate(
          req.user.id, 
          { avatar: result.secure_url }, 
          { new: true }
        ).select('-password');

        res.status(200).json({ 
          url: result.secure_url,
          user: updatedUser 
        });
      }
    );
    
    stream.end(req.file.buffer);

  } catch (error) {
    res.status(500).json({ message: 'Avatar upload failed', error: error.message });
  }
});

module.exports = router;