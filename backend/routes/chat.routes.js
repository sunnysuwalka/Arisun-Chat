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
// --- 1. DELETE SINGLE MESSAGE (Indestructible Version) ---
router.delete('/message/:msgId', async (req, res) => {
  try {
    const msg = await Message.findById(req.params.msgId);
    if (!msg) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // 1. GUARANTEED UI FIX: Always delete from MongoDB first
    await Message.findByIdAndDelete(req.params.msgId);

    // 2. Quietly attempt to delete from Cloudinary in the background
    if (msg.url && msg.url.includes('cloudinary') && cloudinary) {
      try {
        const splitUrl = msg.url.split('/');
        const publicId = `${splitUrl[splitUrl.length - 2]}/${splitUrl[splitUrl.length - 1].split('.')[0]}`;
        const resourceType = ['video', 'audio'].includes(msg.type) ? 'video' : 'image';
        
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      } catch (cloudErr) {
        console.log("⚠️ Cloudinary delete skipped (likely ghost file).");
      }
    }

    res.status(200).json({ message: 'Message deleted' });
  } catch (error) {
    console.error("❌ DELETE ERROR:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// --- 2. CLEAR ENTIRE CHAT (Indestructible Version) ---
router.delete('/clear/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    const messagesWithMedia = await Message.find({ 
      roomId, 
      url: { $exists: true, $ne: null } 
    });

    // 1. GUARANTEED UI FIX: Wipe MongoDB records immediately
    await Message.deleteMany({ roomId });

    // 2. Quietly attempt to clean up Cloudinary in the background
    if (messagesWithMedia.length > 0 && cloudinary) {
      messagesWithMedia.forEach(async (msg) => {
        if (msg.url && msg.url.includes('cloudinary')) {
          try {
            const splitUrl = msg.url.split('/');
            const publicId = `${splitUrl[splitUrl.length - 2]}/${splitUrl[splitUrl.length - 1].split('.')[0]}`;
            const resourceType = ['video', 'audio'].includes(msg.type) ? 'video' : 'image';
            
            await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
          } catch (cloudErr) {
            // Completely ignore files that fail to delete
          }
        }
      });
    }

    res.status(200).json({ message: 'Chat history cleared' });
  } catch (error) {
    console.error("❌ CLEAR CHAT ERROR:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

