require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');
const connectDB = require('./config/db');

const Inbox = require('./models/Inbox');
const Message = require('./models/Message');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// 🔥 CORS Configuration for both Local and Live environments
const allowedOrigins = [
  'http://localhost:3000', 
  'https://arisun-chat.vercel.app'
];

app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true 
}));

// Parse incoming JSON (Only one of these needed!)
app.use(express.json());

// 🕵️ GLOBAL NETWORK LOGGER: See every request that hits the backend
app.use((req, res, next) => {
  console.log(`\n🌐 [NETWORK] ${req.method} request to: ${req.url}`);
  next();
});

// API Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/chat', require('./routes/chat.routes'));
app.use('/api/upload', require('./routes/upload.routes'));

// 🔥 WebSockets Setup with VIP CORS list
const io = new Server(server, {
  cors: { 
    origin: allowedOrigins, 
    credentials: true,
    methods: ["GET", "POST"]
  }
});

const onlineUsers = {};

io.on('connection', (socket) => {
  // ✅ Handle Online Status
  socket.on('user:online', (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit('users:online', Object.keys(onlineUsers));
  });

  // ✅ Join Room
  socket.on('room:join', (roomId) => {
    if (!roomId) return;
    socket.join(roomId);
  });

  // 🔥 Handle Typing Indicators
  socket.on('typing:start', ({ roomId, userId }) => {
    socket.to(roomId).emit('typing:start', { roomId, userId });
  });
  
  socket.on('typing:stop', ({ roomId, userId }) => {
    socket.to(roomId).emit('typing:stop', { roomId, userId });
  });

  // 🔥 Handle Read Receipts
  socket.on('messages:read', ({ byUserId, forUserId }) => {
    const targetSocket = onlineUsers[forUserId];
    if (targetSocket) {
      io.to(targetSocket).emit('messages:read:receipt', { readerId: byUserId });
    }
  });

  // ✅ Handle Friend Requests
  socket.on('request:send', (data) => {
    const targetSocket = onlineUsers[data.toUserId];
    if (targetSocket) {
      io.to(targetSocket).emit('request:received', data);
    }
  });

  socket.on('request:accept', (data) => {
    const targetSocket = onlineUsers[data.fromUserId];
    if (targetSocket) {
      io.to(targetSocket).emit('request:accepted');
    }
  });

  // 🔥 NEW: Pass WebRTC firewall coordinates between browsers
  socket.on('call:ice-candidate', ({ toUserId, candidate }) => {
    const targetSocket = onlineUsers[toUserId];
    if (targetSocket) {
      io.to(targetSocket).emit('call:ice-candidate', candidate);
    }
  });

  socket.on("call:toggle-video", (data) => {
    io.to(data.toUserId).emit("call:toggle-video", data);
  });

  // ✅ Handle Sending Messages
  socket.on('message:send', async (data) => {
    console.log("\n📨 1. RECEIVED EVENT FROM FRONTEND:", data); 

    try {
      const { roomId, message } = data;
      
      if (!roomId || !roomId.includes('_')) {
        console.log("❌ 2. REJECTED: Invalid roomId", roomId);
        return;
      }

      const [user1, user2] = roomId.split('_');
      console.log(`🔍 3. Looking up users in DB - Sender ID sent by React: ${message.sender}`);

      const sender = await User.findById(message.sender);
      const receiver = await User.findById(message.sender.toString() === user1 ? user2 : user1);

      if (!sender || !receiver) {
        console.log("❌ 4. REJECTED: Sender or Receiver not found in DB! Sender:", !!sender, "Receiver:", !!receiver);
        return;
      }

      if (sender.blockedUsers?.includes(receiver._id) || receiver.blockedUsers?.includes(sender._id)) {
        console.log("❌ 5. REJECTED: Someone is blocked.");
        return;
      }

      console.log("✅ 6. Passed all checks! Saving to DB...");

      let inbox = await Inbox.findOne({ users: { $all: [user1, user2] } });
      if (!inbox) {
        inbox = await Inbox.create({
          users: [user1, user2],
          unreadCount: { [user1]: 0, [user2]: 0 }
        });
      }

      const msg = await Message.create({
        ...message,
        roomId,
        inboxId: inbox._id,
        receiver: receiver._id,
        replyTo: message.replyTo || null
      });

      inbox.lastMessage = msg._id;
      const receiverId = receiver._id.toString();
      const current = inbox.unreadCount.get(receiverId) || 0;
      inbox.unreadCount.set(receiverId, current + 1);
      await inbox.save();

      console.log("🎉 7. Saved successfully! Emitting to room...");
      io.to(roomId).emit('message:new', msg);

      const targetSocket = onlineUsers[receiverId];
      if (targetSocket) {
        io.to(targetSocket).emit('inbox:update');
      }
    } catch (err) {
      console.error('❌ MESSAGE CATCH ERROR:', err);
    }
  });

  // 📞 WebRTC Signaling (Calling)
  socket.on('call:initiate', ({ toUserId, signalData, fromUserId, callType }) => {
    console.log("\n☎️ 1. BACKEND RECEIVED CALL REQUEST!");
    console.log(`   From: ${fromUserId} | To: ${toUserId} | Type: ${callType}`);
    
    const targetSocket = onlineUsers[toUserId];
    console.log(`   Target Socket Found in Dictionary? : ${!!targetSocket}`);

    if (targetSocket) {
      io.to(targetSocket).emit('call:incoming', { signalData, fromUserId, callType });
      console.log("   ✅ 2. Forwarded 'call:incoming' to User B!");
    } else {
      console.log("   ❌ ERROR: User B is not online or socket ID is missing!");
    }
  });

  socket.on('call:accept', ({ toUserId, signalData }) => {
    const targetSocket = onlineUsers[toUserId];
    if (targetSocket) {
      io.to(targetSocket).emit('call:accepted', signalData);
    }
  });

  socket.on('call:reject', (data) => {
    console.log(`🛑 BACKEND: Rejecting call to ${data.toUserId} because: ${data.reason}`);
    
    const targetSocket = onlineUsers[data.toUserId];
    if (targetSocket) {
      io.to(targetSocket).emit('call:rejected', data);
    }
  });

  socket.on('call:end', ({ toUserId }) => {
    const targetSocket = onlineUsers[toUserId];
    if (targetSocket) {
      io.to(targetSocket).emit('call:ended');
    }
  });

  // ✅ Handle Disconnects
  socket.on('disconnect', () => {
    const userId = Object.keys(onlineUsers).find(id => onlineUsers[id] === socket.id);
    if (userId) {
      delete onlineUsers[userId];
      io.emit('users:online', Object.keys(onlineUsers));
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = { io };