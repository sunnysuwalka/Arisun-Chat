const Inbox = require('../models/Inbox');
const User = require('../models/User');
const Message = require('../models/Message');

exports.getInbox = async (req, res) => {
  try {
    const userId = req.user.id || req.userId;

    const inbox = await Inbox.find({ users: userId })
      .sort({ updatedAt: -1 })
      .populate('lastMessage')
      .lean();

    const formatted = await Promise.all(
      inbox.map(async (item) => {
        const otherUserId = item.users.find(u => u.toString() !== userId);
        const user = await User.findById(otherUserId).select('username avatar').lean();
        return {
          user,
          lastMessage: item.lastMessage,
          unreadCount: item.unreadCount?.[userId] || 0
        };
      })
    );
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load inbox' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.userId;
    const { otherUserId } = req.body;

    await Message.updateMany(
      { sender: otherUserId, receiver: userId, seen: false },
      { $set: { seen: true } }
    );

    // Reset inbox unread count
    const inbox = await Inbox.findOne({ users: { $all: [userId, otherUserId] } });
    if (inbox) {
        inbox.unreadCount.set(userId, 0);
        await inbox.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const userId = req.user.id || req.userId;
    const msg = await Message.findById(req.params.id);

    if (!msg) return res.status(404).json({ error: 'Not found' });
    if (msg.sender.toString() !== userId) return res.status(403).json({ error: 'Not allowed' });

    await msg.deleteOne();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Delete failed' });
  }
};

exports.clearChat = async (req, res) => {
  try {
    const { roomId } = req.params;
    await Message.deleteMany({ roomId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Clear failed' });
  }
};

// ADD THIS TO THE BOTTOM OF chat.controller.js

exports.getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Find all messages for this room and sort them by time (oldest to newest)
    const messages = await Message.find({ roomId }).sort({ createdAt: 1 });
    
    res.json(messages);
  } catch (err) {
    console.error('Failed to load messages:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
};

// ✅ Add these back to the bottom of chat.controller.js

exports.editMessage = async (req, res) => {
  try {
    const userId = req.user.id || req.userId;
    const msg = await Message.findById(req.params.id);

    if (!msg) return res.status(404).json({ error: 'Not found' });

    if (msg.sender.toString() !== userId) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    msg.text = req.body.text;
    msg.edited = true;

    await msg.save();

    res.json(msg);
  } catch {
    res.status(500).json({ error: 'Edit failed' });
  }
};

exports.reactMessage = async (req, res) => {
  try {
    const userId = req.user.id || req.userId;
    const { messageId, emoji } = req.body;

    const msg = await Message.findById(messageId);

    if (!msg) return res.status(404).json({ error: 'Not found' });

    msg.reactions = msg.reactions.filter(
      r => r.userId.toString() !== userId
    );

    msg.reactions.push({
      userId: userId,
      emoji
    });

    await msg.save();

    res.json(msg);
  } catch {
    res.status(500).json({ error: 'Reaction failed' });
  }
};

