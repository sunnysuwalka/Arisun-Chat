import { create } from 'zustand';
import api from '../utils/api';
import { getSocket } from '../utils/socket';

export const useChatStore = create((set, get) => ({
  // 🔥 UPGRADED: Robust Call State Management (Destroys Ghosts)
  callState: null, 
  setCallState: (updates) => set((state) => {
    if (updates === null) return { callState: null };
    
    // If we are starting a fresh call (initiating or receiving), overwrite everything to kill ghosts
    if (updates.isInitiator || updates.isReceivingCall) {
      return { callState: updates };
    }
    
    // Otherwise, safely merge micro-updates (like tokens or callStatus)
    return { callState: { ...state.callState, ...updates } };
  }),
  clearCallState: () => set({ callState: null }),

  // 🔥 NEW: Securely fetch LiveKit Token from backend
  generateLiveKitToken: async (roomName, participantName) => {
    try {
      const res = await api.post('/call/token', { roomName, participantName });
      const token = res.data.token;
      
      set((state) => ({
        callState: state.callState ? { ...state.callState, livekitToken: token } : null
      }));
      
      return token;
    } catch (error) {
      console.error('Failed to fetch LiveKit token:', error);
      return null;
    }
  },

  contacts: [],
  inbox: [], 
  activeContact: null,
  messages: {},

  hiddenChats: JSON.parse(localStorage.getItem('hiddenChats')) || [],

  hasMore: {}, 
  roomPages: {},

  typingUsers: {},
  requests: [],
  sentRequests: [],
  blockedUsers: [], 
  onlineUsers: [],
  unread: {}, 

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  hideChat: (contactId) => set(state => {
    const updated = [...new Set([...state.hiddenChats, contactId])];
    localStorage.setItem('hiddenChats', JSON.stringify(updated));
    return { hiddenChats: updated };
  }),

  unhideChat: (contactId) => set(state => {
    const updated = state.hiddenChats.filter(id => id !== contactId);
    localStorage.setItem('hiddenChats', JSON.stringify(updated));
    return { hiddenChats: updated };
  }),

  setActiveContact: (contact) => {
    if (!contact) {
      set({ activeContact: null });
      return; 
    }

    const contactId = contact._id || contact.id;
    if (get().hiddenChats.includes(contactId)) {
      get().unhideChat(contactId);
    }

    set(state => ({
      activeContact: contact,
      unread: { ...state.unread, [contactId]: 0 }
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

  loadBlockedUsers: async () => {
    try {
      const res = await api.get('/users/blocked');
      set({ blockedUsers: Array.isArray(res.data) ? res.data : [] });
    } catch (err) {
      set({ blockedUsers: [] });
    }
  },

  loadMessages: async (roomId, page = 1) => {
    try {
      const res = await api.get(`/chat/${roomId}?page=${page}&limit=50`);
      
      set(state => {
        const existingMessages = state.messages[roomId] || [];
        const newMessages = page === 1 ? res.data : [...res.data, ...existingMessages];
        
        return { 
          messages: { ...state.messages, [roomId]: newMessages },
          hasMore: { ...state.hasMore, [roomId]: res.data.length === 50 },
          roomPages: { ...state.roomPages, [roomId]: page }
        };
      });
    } catch (err) {
      console.error("Failed to load messages");
    }
  },

  addMessage: (roomId, newMessage) => {
    set((state) => {
      const currentMessages = state.messages[roomId] || [];
      const isDuplicate = currentMessages.some(msg => (msg._id || msg.id) === (newMessage._id || newMessage.id));
      if (isDuplicate) return state; 

      let newHiddenChats = state.hiddenChats;
      const [u1, u2] = roomId.split('_');
      if (newHiddenChats.includes(u1) || newHiddenChats.includes(u2)) {
        newHiddenChats = newHiddenChats.filter(id => id !== u1 && id !== u2);
        localStorage.setItem('hiddenChats', JSON.stringify(newHiddenChats));
      }

      return {
        hiddenChats: newHiddenChats,
        messages: { ...state.messages, [roomId]: [...currentMessages, newMessage] }
      };
    });
  },

  removeMessage: (roomId, messageId) => {
    set(state => {
      const roomMsgs = state.messages[roomId];
      if (!roomMsgs) return state;
      return {
        messages: { ...state.messages, [roomId]: roomMsgs.filter(m => (m._id || m.id) !== messageId) }
      };
    });
  },

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

  updateMessageReactions: (roomId, msgId, newReactions) => {
    set(state => {
      const roomMsgs = state.messages[roomId];
      const updatedMessages = roomMsgs ? roomMsgs.map(m => (m._id || m.id) === msgId ? { ...m, reactions: newReactions } : m) : [];

      const updatedInbox = (state.inbox || []).map(inboxItem => {
        if (inboxItem.lastMessage && (inboxItem.lastMessage._id || inboxItem.lastMessage.id) === msgId) {
          return {
            ...inboxItem,
            lastMessage: { ...inboxItem.lastMessage, reactions: newReactions }
          };
        }
        return inboxItem;
      });

      return { messages: { ...state.messages, [roomId]: updatedMessages }, inbox: updatedInbox };
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

  acceptRequest: async (senderId) => {
    try {
      await api.put(`/users/request/${senderId}`, { action: 'accept' });
      set(state => ({
        requests: (state.requests || []).filter(r => r.sender !== senderId)
      }));
      get().loadContacts();
      get().loadInbox(); 
    } catch {}
  },

  declineRequest: async (senderId) => {
    try {
      await api.put(`/users/request/${senderId}`, { action: 'decline' });
      set(state => ({
        requests: (state.requests || []).filter(r => r.sender !== senderId)
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
  },

  loadSentRequests: async () => {
    try {
      const res = await api.get('/notifications/sent');
      set({ sentRequests: Array.isArray(res.data) ? res.data : [] });
    } catch (err) {
      set({ sentRequests: [] });
    }
  },

  addSentRequest: (userId) => set(state => ({ 
    sentRequests: [...new Set([...state.sentRequests, userId])] 
  })),

  removeSentRequest: (userId) => set(state => ({ 
    sentRequests: state.sentRequests.filter(id => id !== userId) 
  })),
}));