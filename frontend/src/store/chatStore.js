import { create } from 'zustand';
import api from '../utils/api';
import { getSocket } from '../utils/socket';

export const useChatStore = create((set, get) => ({
  callState: null, // Track incoming/active calls
  setCallState: (state) => set({ callState: state }),
  contacts: [],
  inbox: [], 
  activeContact: null,
  messages: {},
  typingUsers: {},
  requests: [],
  onlineUsers: [],
  unread: {}, 
  

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  setActiveContact: (contact) => {

    if (!contact) {
      set({ activeContact: null });
      return; 
    }

    set(state => ({
      activeContact: contact,
      unread: {
        ...state.unread,
        [contact.id]: 0 
      }
    }));
  },

  loadContacts: async () => {
    try {
      const res = await api.get('/users/contacts');
      const contacts = res.data.map(c => ({
        ...c,
        lastMessage: c.lastMessage || null
      }));
      set({ contacts });
    } catch {}
  },

  loadInbox: async () => {
    try {
      const res = await api.get('/chat/inbox');
      set({ inbox: Array.isArray(res.data) ? res.data : [] });
    } catch (err) {
      set({ inbox: [] }); 
    }
  },

  loadRequests: async () => {
    try {
      const res = await api.get('/users/requests');
      set({ requests: Array.isArray(res.data) ? res.data : [] });
    } catch (err) {
      set({ requests: [] }); 
    }
  },

  loadMessages: async (roomId) => {
    try {
      console.log(`📡 Fetching messages for room: ${roomId}`);
      const res = await api.get(`/chat/${roomId}`);
      console.log(`✅ Backend returned ${res.data.length} messages!`, res.data);
      
      set(state => ({
        messages: {
          ...state.messages,
          [roomId]: res.data
        }
      }));
    } catch (err) {
      console.error("❌ FAILED TO LOAD MESSAGES:", err.response?.data || err.message);
    }
  },

  addMessage: (roomId, newMessage) => {
    set((state) => {
      const currentMessages = state.messages[roomId] || [];
      
      // 🔥 THE SHIELD: Check if this exact message is already in the array!
      const isDuplicate = currentMessages.some(
        (msg) => (msg._id || msg.id) === (newMessage._id || newMessage.id)
      );

      // If we already have it, ignore the socket event and do nothing
      if (isDuplicate) {
        return state; 
      }

      // Otherwise, add it safely to the bottom of the list
      return {
        messages: {
          ...state.messages,
          [roomId]: [...currentMessages, newMessage]
        }
      };
    });
  },

  removeMessage: (roomId, messageId) => {
    set(state => {
      const roomMsgs = state.messages[roomId];
      if (!roomMsgs) return state;

      return {
        messages: {
          ...state.messages,
          [roomId]: roomMsgs.filter(m => (m._id || m.id) !== messageId)
        }
      };
    });
  },

  // 🔥 NEW: Instantly update a message in the UI (for Edits and Reactions)
  updateMessage: (roomId, messageId, updates) => {
    set(state => {
      const roomMsgs = state.messages[roomId];
      if (!roomMsgs) return state;

      return {
        messages: {
          ...state.messages,
          [roomId]: roomMsgs.map(m => (m._id || m.id) === messageId ? { ...m, ...updates } : m)
        }
      };
    });
  },

  setTyping: (roomId, userId, isTyping) => {
    set(state => ({
      typingUsers: {
        ...state.typingUsers,
        [roomId]: isTyping
          ? [...new Set([...(state.typingUsers[roomId] || []), userId])]
          : (state.typingUsers[roomId] || []).filter(id => id !== userId),
      },
    }));
  },

  addRequest: (request) => {
    set(state => ({ requests: [...(state.requests || []), request] }));
  },

  acceptRequest: async (requestId) => {
    try {
      await api.put(`/users/request/${requestId}`, { action: 'accept' });
      set(state => ({
        requests: (state.requests || []).filter(r => (r._id || r.id) !== requestId)
      }));
      get().loadContacts();
      get().loadInbox(); 
    } catch {}
  },

  declineRequest: async (requestId) => {
    try {
      await api.put(`/users/request/${requestId}`, { action: 'decline' });
      set(state => ({
        requests: (state.requests || []).filter(r => (r._id || r.id) !== requestId)
      }));
    } catch {}
  },

  markAsRead: async (otherUserId, myId) => {
    try {
      await api.post('/chat/read', { otherUserId });
      set(state => ({
        inbox: (state.inbox || []).map(item =>
          item.user?._id === otherUserId || item.user?.id === otherUserId
            ? { ...item, unreadCount: 0 }
            : item
        )
      }));
      if (myId) {
        getSocket().emit('messages:read', { byUserId: myId, forUserId: otherUserId });
      }
    } catch {}
  },

  markMessagesAsSeen: (readerId, myId) => {
    const roomId = [readerId, myId].sort().join('_');
    set(state => {
      const roomMsgs = state.messages[roomId];
      if (!roomMsgs) return state;
      
      const updated = roomMsgs.map(m => 
        (m.sender === myId || m.senderId === myId) && !m.seen
          ? { ...m, seen: true, updatedAt: new Date().toISOString() } 
          : m
      );
      
      return { messages: { ...state.messages, [roomId]: updated } };
    });
  }
}));