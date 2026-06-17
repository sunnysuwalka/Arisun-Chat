const cloudinaryBase = require('cloudinary'); // 🔥 1. Grab the base object
const cloudinary = cloudinaryBase.v2;         // 🔥 2. Extract v2 for our own config
const multerCloudinary = require('multer-storage-cloudinary');
const multer = require('multer'); 

const CloudinaryStorage = multerCloudinary.CloudinaryStorage || multerCloudinary;

console.log("☁️ [CLOUDINARY] Initializing Cloudinary config...");

// Configure using v2
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinaryBase, // 🔥 3. THE FIX: Pass the base object here, NOT v2
  params: {
    folder: 'arisun_chat',
    resource_type: 'auto', 
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'wav', 'mp3', 'pdf', 'doc', 'docx']
  },
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, storage, upload };