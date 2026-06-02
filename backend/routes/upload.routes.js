const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');

router.post('/file', upload.single('file'), (req, res) => {
  console.log("📂 [UPLOAD] Hit /api/upload/file route!");
  
  try {
    console.log("📂 [UPLOAD] Checking req.file object:", req.file);
    
    if (!req.file) {
      console.log("❌ [UPLOAD ERROR] req.file is undefined! Multer failed to grab the file.");
      return res.status(400).json({ message: 'No file provided' });
    }
    
    console.log("✅ [UPLOAD SUCCESS] File uploaded to Cloudinary:", req.file.path);
    
    res.status(200).json({ 
      url: req.file.path,
      type: req.file.mimetype.split('/')[0] 
    }); 
  } catch (error) {
    console.error("❌ [UPLOAD CRASH] Error inside upload route:", error);
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
});

module.exports = router;