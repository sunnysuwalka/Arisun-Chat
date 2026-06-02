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
// --- 1. DELETE SINGLE MESSAGE ---
router.delete('/message/:msgId', async (req, res) => {
  try {
    const msg = await Message.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    // Cloudinary Safety Net
    if (msg.url && msg.url.includes('cloudinary') && cloudinary) {
      try {
        const publicId = getPublicIdFromUrl(msg.url);
        const resourceType = ['video', 'audio'].includes(msg.type) ? 'video' : 'image';
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      } catch (cloudErr) {
        console.log("Ignored Cloudinary Error:", cloudErr.message);
      }
    }

    await Message.findByIdAndDelete(req.params.msgId);
    res.status(200).json({ message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Delete failed', error: error.message });
  }
});

// --- 2. CLEAR ENTIRE CHAT ---
router.delete('/clear/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const messagesWithMedia = await Message.find({ roomId, url: { $exists: true, $ne: null } });

    // Cloudinary Safety Net
    if (messagesWithMedia.length > 0 && cloudinary) {
      const deletePromises = messagesWithMedia.map(msg => {
        try {
          const publicId = getPublicIdFromUrl(msg.url);
          if (publicId) {
            const resourceType = ['video', 'audio'].includes(msg.type) ? 'video' : 'image';
            return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
          }
        } catch (err) {
           return null;
        }
        return null;
      }).filter(Boolean);

      await Promise.allSettled(deletePromises); // Won't crash if one file fails
    }

    await Message.deleteMany({ roomId });
    res.status(200).json({ message: 'Chat history permanently deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to clear chat', error: error.message });
  }
});

