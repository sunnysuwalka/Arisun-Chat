const cloudinary = require('cloudinary').v2;
const multer = require('multer');

console.log("☁️ [CLOUDINARY] Initializing direct-pipe config...");

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. 🔥 THE FIX: Use Node's RAM instead of the broken third-party library
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = { cloudinary, upload };