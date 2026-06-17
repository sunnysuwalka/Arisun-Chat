const Chat = require('../models/chat');
const User = require('../models/user');

const getIo = () => {
  try {
    const { io } = require('../server');
    return io;
  } catch (e) {
    console.error("Socket IO not found in group controller");
    return null;
  }
};

exports.createGroup = async (req, res) => {
  if (!req.body.users || !req.body.name) return res.status(400).send({ message: "Please fill all the fields" });
  let users = JSON.parse(req.body.users);
  if (users.length < 2) return res.status(400).send("More than 2 users are required");

  users.push(req.user.id);
  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user.id,
    });
    const fullGroupChat = await Chat.findOne({ _id: groupChat._id }).populate("users", "-password").populate("groupAdmin", "-password");
    
    const io = getIo();
    if (io && fullGroupChat) {
       fullGroupChat.users.forEach(u => io.to(u._id.toString()).emit('group:update'));
    }

    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(400); throw new Error(error.message);
  }
};

exports.fetchGroups = async (req, res) => {
  try {
    const groups = await Chat.find({ 
        isGroupChat: true,
        $or: [{ users: req.user.id }, { removedUsers: req.user.id }]
      })
      .populate("users", "-password").populate("groupAdmin", "-password").populate("latestMessage").sort({ updatedAt: -1 });
    res.status(200).json(groups);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.renameGroup = async (req, res) => {
  const { chatId, chatName } = req.body;
  const updatedChat = await Chat.findByIdAndUpdate(chatId, { chatName: chatName }, { new: true })
    .populate("users", "-password").populate("groupAdmin", "-password");
  if (!updatedChat) return res.status(404).json({ error: "Chat Not Found" });

  const io = getIo();
  if (io) updatedChat.users.forEach(u => io.to(u._id.toString()).emit('group:update'));

  res.json(updatedChat);
};

exports.updateGroupAvatar = async (req, res) => {
  const { chatId, groupAvatar } = req.body;
  const updatedChat = await Chat.findByIdAndUpdate(chatId, { groupAvatar }, { new: true })
    .populate("users", "-password").populate("groupAdmin", "-password");
  if (!updatedChat) return res.status(404).json({ error: "Chat Not Found" });

  const io = getIo();
  if (io) updatedChat.users.forEach(u => io.to(u._id.toString()).emit('group:update'));

  res.json(updatedChat);
};

exports.addToGroup = async (req, res) => {
  const { chatId, userId } = req.body;
  const added = await Chat.findByIdAndUpdate(chatId, { 
      $push: { users: userId },
      $pull: { removedUsers: userId }
    }, { new: true })
    .populate("users", "-password").populate("groupAdmin", "-password");
  if (!added) return res.status(404).json({ error: "Chat Not Found" });

  const io = getIo();
  if (io) {
     io.to(userId.toString()).emit('group:update');
     added.users.forEach(u => {
        if (u._id.toString() !== userId.toString()) {
           io.to(u._id.toString()).emit('group:update');
        }
     });
  }

  res.json(added);
};

exports.removeFromGroup = async (req, res) => {
  const { chatId, userId } = req.body;
  const removed = await Chat.findByIdAndUpdate(chatId, { 
      $pull: { users: userId },
      $addToSet: { removedUsers: userId }
    }, { new: true })
    .populate("users", "-password").populate("groupAdmin", "-password");
  if (!removed) return res.status(404).json({ error: "Chat Not Found" });

  const io = getIo();
  if (io) {
     io.to(userId.toString()).emit('group:update'); 
     removed.users.forEach(u => {
        io.to(u._id.toString()).emit('group:update'); 
     });
  }

  res.json(removed);
};

// 🔥 NEW: Destroys the group for everyone instantly
exports.deleteGroup = async (req, res) => {
  const { chatId } = req.body;
  const deletedChat = await Chat.findByIdAndUpdate(chatId, { isDeleted: true }, { new: true })
    .populate("users", "-password").populate("groupAdmin", "-password");
    
  if (!deletedChat) return res.status(404).json({ error: "Chat Not Found" });

  const io = getIo();
  if (io) {
     // Broadcast the death of the group to literally everyone who was ever in it
     deletedChat.users.forEach(u => io.to(u._id.toString()).emit('group:update'));
     deletedChat.removedUsers.forEach(u => io.to(u._id.toString()).emit('group:update'));
  }

  res.json(deletedChat);
};