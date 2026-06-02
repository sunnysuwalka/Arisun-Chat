const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Ensure uploads directory exists, otherwise multer might crash
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// ✅ Original Avatar Route
router.post('/avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  res.json({
    url: `http://localhost:5000/uploads/${req.file.filename}`
  });
});

// 🔥 NEW: Chat File Upload Route
router.post('/file', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Determine file type for the frontend bubbles
  const ext = path.extname(req.file.originalname).toLowerCase();
  let type = 'file'; // Default to a downloadable file

  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    type = 'image';
  } else if (['.mp4', '.webm', '.ogg', '.mov'].includes(ext)) {
    type = 'video';
  } else if (['.mp3', '.wav', '.m4a'].includes(ext)) {
    type = 'audio';
  }

  // Return exactly what ChatWindow.jsx is expecting
  res.json({
    url: `http://localhost:5000/uploads/${req.file.filename}`,
    type: type,
    fileName: req.file.originalname,
    fileSize: req.file.size
  });
});

module.exports = router;