const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');

router.post('/file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    
    // req.file.path contains the full Cloudinary URL!
    res.status(200).json({ fileUrl: req.file.path }); 
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
});

module.exports = router;