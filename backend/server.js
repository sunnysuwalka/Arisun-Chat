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
const Chat = require('./models/Chat'); 

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
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/call', require('./routes/call.routes'));
app.use('/api/groups', require('./routes/group.routes'));

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
  socket.on('user:online', (userId) => {
    socket.join(userId);
    onlineUsers[userId] = socket.id;
    io.emit('users:online', Object.keys(onlineUsers));
  });

  socket.on('room:join', (roomId) => {
    if (!roomId) return;
    socket.join(roomId);
  });

  socket.on('typing:start', ({ roomId, userId }) => {
    socket.to(roomId).emit('typing:start', { roomId, userId });
  });
  
  socket.on('typing:stop', ({ roomId, userId }) => {
    socket.to(roomId).emit('typing:stop', { roomId, userId });
  });

  socket.on('messages:read', ({ byUserId, forUserId }) => {
    const targetSocket = onlineUsers[forUserId];
    if (targetSocket) {
      io.to(targetSocket).emit('messages:read:receipt', { readerId: byUserId });
    }
  });

  // 📞 CALL SIGNALING
  socket.on('call:initiate', async (data) => {
    if (data.isGroup && data.groupId) {
      try {
        const chat = await Chat.findById(data.groupId);
        if (chat) {
          chat.users.forEach(userId => {
            if (userId.toString() === data.fromUserId) return; 
            const targetSocket = onlineUsers[userId.toString()];
            if (targetSocket) io.to(targetSocket).emit('call:incoming', data);
          });
        }
      } catch (err) { console.error("Call group error", err); }
    } else if (data.toUserId) {
      const targetSocket = onlineUsers[data.toUserId];
      if (targetSocket) io.to(targetSocket).emit('call:incoming', data);
    }
  });

  socket.on('call:accept', async (data) => {
    if (data.isGroup && data.groupId) {
      try {
        const chat = await Chat.findById(data.groupId);
        if (chat) {
          chat.users.forEach(userId => {
            if (userId.toString() === data.fromUserId) return; 
            const targetSocket = onlineUsers[userId.toString()];
            if (targetSocket) io.to(targetSocket).emit('call:accepted', data);
          });
        }
      } catch (err) {}
    } else if (data.toUserId) {
      const targetSocket = onlineUsers[data.toUserId];
      if (targetSocket) io.to(targetSocket).emit('call:accepted', data);
    }
  });

  socket.on('call:reject', async (data) => {
    if (data.isGroup && data.groupId) {
      try {
        const chat = await Chat.findById(data.groupId);
        if (chat) {
          chat.users.forEach(userId => {
            if (userId.toString() === data.fromUserId) return; 
            const targetSocket = onlineUsers[userId.toString()];
            if (targetSocket) io.to(targetSocket).emit('call:rejected', data);
          });
        }
      } catch (err) {}
    } else if (data.toUserId) {
      const targetSocket = onlineUsers[data.toUserId];
      if (targetSocket) io.to(targetSocket).emit('call:rejected', data);
    }
  });

  socket.on('call:end', async (data) => {
    if (data.isGroup && data.groupId) {
      try {
        const chat = await Chat.findById(data.groupId);
        if (chat) {
          chat.users.forEach(userId => {
            if (userId.toString() === data.fromUserId) return; 
            const targetSocket = onlineUsers[userId.toString()];
            if (targetSocket) io.to(targetSocket).emit('call:ended', data);
          });
        }
      } catch (err) {}
    } else if (data.toUserId) {
      const targetSocket = onlineUsers[data.toUserId];
      if (targetSocket) io.to(targetSocket).emit('call:ended', data);
    }
  });

  socket.on('request:send', async (data) => {
    const targetSocket = onlineUsers[data.toUserId];
    if (targetSocket) {
      const receiver = await User.findById(data.toUserId);
      const isBlocked = receiver?.blockedUsers?.some(id => id.toString() === data.sender.toString());
      
      if (!isBlocked) {
        io.to(targetSocket).emit('request:received', data);
      }
    }
  });

  socket.on('request:accept', (data) => {
    const targetSocket = onlineUsers[data.fromUserId];
    if (targetSocket) {
      io.to(targetSocket).emit('request:accepted');
    }
  });

  socket.on('friend:remove', ({ userId }) => {
    const targetSocket = onlineUsers[userId];
    if (targetSocket) {
      io.to(targetSocket).emit('friend:remove');
    }
  });

  // 🔥 UNIVERSAL MESSAGE ROUTER
  socket.on('message:send', async (data) => {
    console.log("\n📨 1. RECEIVED EVENT FROM FRONTEND:", data); 

    try {
      const { roomId, message } = data;
      if (!roomId) return;

      const sender = await User.findById(message.sender);
      if (!sender) return;

      // ---------------------------------------------------------
      // 🚀 PATH A: GROUP CHAT ROUTING (Ultra-Secure Edition)
      // ---------------------------------------------------------
      if (!roomId.includes('_')) {
        const chat = await Chat.findById(roomId);
        
        if (!chat || !chat.isGroupChat) return;

        // Security Check 1: Is the sender an active member?
        if (!chat.users.includes(sender._id)) {
           console.log("❌ REJECTED: Sender not in active group list. Message dropped.");
           return;
        }

        const msg = await Message.create({
          ...message,
          roomId,
          replyTo: message.replyTo || null
        });

        chat.latestMessage = msg._id;
        await chat.save();

        // 🔥 THE FIX: Stop broadcasting to rooms! Individually send to verified active users.
        // This guarantees removed users NEVER receive messages.
        chat.users.forEach(userId => {
           const targetSocket = onlineUsers[userId.toString()];
           if (targetSocket) {
              io.to(targetSocket).emit('message:new', msg);
              io.to(targetSocket).emit('inbox:update');
           }
        });
        return; 
      }

      // ---------------------------------------------------------
      // 🔒 PATH B: 1-TO-1 CHAT ROUTING
      // ---------------------------------------------------------
      const [user1, user2] = roomId.split('_');
      const receiver = await User.findById(message.sender.toString() === user1 ? user2 : user1);

      if (!receiver) return;

      const senderBlockedReceiver = sender.blockedUsers?.some(id => id.toString() === receiver._id.toString());
      const receiverBlockedSender = receiver.blockedUsers?.some(id => id.toString() === sender._id.toString());

      if (senderBlockedReceiver || receiverBlockedSender) {
        console.log("❌ REJECTED: Message dropped by Invisible Shield.");
        return; 
      }

      if (!sender.friends.includes(receiver._id) || !receiver.friends.includes(sender._id)) {
         console.log("❌ REJECTED: Users are no longer friends.");
         return;
      }

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

      io.to(roomId).emit('message:new', msg);

      const targetSocket = onlineUsers[receiverId];
      if (targetSocket) {
        io.to(targetSocket).emit('inbox:update');
        const receiverSocket = io.sockets.sockets.get(targetSocket);
        const isInRoom = receiverSocket && receiverSocket.rooms.has(roomId);
        if (!isInRoom) {
          io.to(targetSocket).emit('message:new', msg);
        }
      }
    } catch (err) {
      console.error('❌ MESSAGE CATCH ERROR:', err);
    }
  });

  socket.on('disconnect', () => {
    const userId = Object.keys(onlineUsers).find(id => onlineUsers[id] === socket.id);
    if (userId) {
      delete onlineUsers[userId];
      io.emit('users:online', Object.keys(onlineUsers));
    }
  });
});

const mongoose = require('mongoose'); 

mongoose.connection.once('open', async () => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: 'users' }).toArray();
    
    if (collections.length > 0) {
      await db.collection('users').dropIndex('mobile_1');
    }
  } catch (err) {}
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = { io };