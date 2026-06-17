const cloudinary = require('cloudinary').v2;
const multerCloudinary = require('multer-storage-cloudinary');

// 🔥 THE FIX: Dynamically grab the constructor regardless of which package version is installed
const CloudinaryStorage = multerCloudinary.CloudinaryStorage || multerCloudinary;

console.log("☁️ [CLOUDINARY] Initializing Cloudinary config...");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'arisun_chat',
    resource_type: 'auto', 
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'wav', 'mp3', 'pdf', 'doc', 'docx']
  },
});

module.exports = { cloudinary, storage };