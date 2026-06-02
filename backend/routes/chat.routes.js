const router = require('express').Router();
const { cloudinary } = require('../config/cloudinary');

const {
  getInbox,
  markAsRead,
  clearChat,
  deleteMessage,
  editMessage,
  reactMessage,
  getMessages // ✅ Added our new function here
} = require('../controllers/chat.controller');

const auth = require('../middleware/auth');

// 📥 Inbox
router.get('/inbox', auth, getInbox);

// ✅ Mark as read
router.post('/read', auth, markAsRead);


// Edit & React
router.put('/message/:id', auth, editMessage);
router.post('/react', auth, reactMessage);

// 💬 Get Room Messages (Keep this at the bottom so it doesn't conflict with /inbox)
router.get('/:roomId', auth, getMessages); 

module.exports = router;

// --- HELPER: Extract Cloudinary Public ID from URL ---
const getPublicIdFromUrl = (url) => {
  if (!url || !url.includes('cloudinary')) return null;
  // Looks for 'arisun_chat/filename.jpg' and drops the '.jpg'
  const splitUrl = url.split('/');
  const folderAndFile = `${splitUrl[splitUrl.length - 2]}/${splitUrl[splitUrl.length - 1]}`;
  return folderAndFile.split('.')[0];
};
const { cloudinary } = require('../config/cloudinary');
const Message = require('../models/Message');

// --- 1. DELETE SINGLE MESSAGE ---
router.delete('/message/:msgId', async (req, res) => {
  console.log(`\n🗑️ [DELETE SINGLE] Initiating delete for Message ID: ${req.params.msgId}`);
  try {
    const msg = await Message.findById(req.params.msgId);
    if (!msg) {
      console.log("❌ [DELETE ERROR] Message not found in database.");
      return res.status(404).json({ message: 'Message not found' });
    }

    console.log("🗑️ [DELETE] Found message in DB. Deleting from MongoDB now...");
    await Message.findByIdAndDelete(req.params.msgId);

    if (msg.url && msg.url.includes('cloudinary') && cloudinary) {
      console.log("☁️ [DELETE] Cloudinary URL detected. Attempting background cleanup...");
      try {
        const splitUrl = msg.url.split('/');
        const publicId = `${splitUrl[splitUrl.length - 2]}/${splitUrl[splitUrl.length - 1].split('.')[0]}`;
        const resourceType = ['video', 'audio'].includes(msg.type) ? 'video' : 'image';
        
        console.log(`☁️ [DELETE] Extracted Public ID: ${publicId}. Resource Type: ${resourceType}`);
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        console.log("✅ [DELETE] Cloudinary cleanup successful.");
      } catch (cloudErr) {
        console.log("⚠️ [DELETE WARNING] Cloudinary cleanup failed (probably a ghost file). Error:", cloudErr.message);
      }
    }

    console.log("✅ [DELETE SUCCESS] Single message deletion complete.");
    res.status(200).json({ message: 'Message deleted' });
  } catch (error) {
    console.error("❌ [DELETE CRASH] Critical server error during single delete:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// --- 2. CLEAR ENTIRE CHAT ---
router.delete('/clear/:roomId', async (req, res) => {
  console.log(`\n💥 [CLEAR CHAT] Initiating clear for Room ID: ${req.params.roomId}`);
  try {
    const { roomId } = req.params;

    console.log("💥 [CLEAR CHAT] Finding media messages for Cloudinary cleanup...");
    const messagesWithMedia = await Message.find({ roomId, url: { $exists: true, $ne: null } });
    console.log(`💥 [CLEAR CHAT] Found ${messagesWithMedia.length} files attached to this chat.`);

    console.log("💥 [CLEAR CHAT] Wiping MongoDB records...");
    await Message.deleteMany({ roomId });

    if (messagesWithMedia.length > 0 && cloudinary) {
      console.log("☁️ [CLEAR CHAT] Attempting Cloudinary cleanup for attached files...");
      messagesWithMedia.forEach(async (msg) => {
        if (msg.url && msg.url.includes('cloudinary')) {
          try {
            const splitUrl = msg.url.split('/');
            const publicId = `${splitUrl[splitUrl.length - 2]}/${splitUrl[splitUrl.length - 1].split('.')[0]}`;
            const resourceType = ['video', 'audio'].includes(msg.type) ? 'video' : 'image';
            
            await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
          } catch (cloudErr) {
             console.log(`⚠️ [CLEAR CHAT] Could not delete ${msg.url} from Cloudinary.`);
          }
        }
      });
    }

    console.log("✅ [CLEAR CHAT SUCCESS] Chat completely wiped.");
    res.status(200).json({ message: 'Chat history cleared' });
  } catch (error) {
    console.error("❌ [CLEAR CHAT CRASH] Critical server error during clear chat:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

