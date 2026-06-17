exports.createGroup = async (req, res) => {
  // Capture groupAvatar from the request body
  const { name, users, groupAvatar } = req.body;

  if (!users || !name) {
    return res.status(400).send({ message: "Please fill all the fields" });
  }

  let parsedUsers = JSON.parse(users);
  
  // 🔥 MEMBERSHIP GUARD: Add creator + users check
  parsedUsers.push(req.user.id);
  if (parsedUsers.length < 3) {
    return res.status(400).send("Group must have at least 3 members (Admin + 2).");
  }

  try {
    const groupChat = await Chat.create({
      chatName: name,
      users: parsedUsers,
      isGroupChat: true,
      groupAdmin: req.user.id,
      groupAvatar: groupAvatar || "" // 🔥 NOW SAVING THE AVATAR
    });

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate("users", "-password")
      .populate("groupAdmin", "-password");
    
    const io = getIo();
    if (io && fullGroupChat) {
       fullGroupChat.users.forEach(u => io.to(u._id.toString()).emit('group:update'));
    }

    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};