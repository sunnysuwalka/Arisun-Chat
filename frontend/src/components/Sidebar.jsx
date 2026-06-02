import React, { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { getSocket } from '../utils/socket';

// 🔥 THE DECODER: Translates our hidden JSON back into a clean preview string
const formatLastMessage = (msg) => {
  if (!msg) return 'Start chatting';
  
  if (msg.type === 'text') {
    if (msg.text && msg.text.startsWith('📞CALL_LOG::')) {
      try {
        const jsonString = msg.text.replace('📞CALL_LOG::', '');
        const parsed = JSON.parse(jsonString);
        
        const callType = parsed.type === 'video' ? 'video' : 'audio';
        const isMissed = parsed.status !== 'connected';
        
        if (isMissed) {
          return `Missed ${callType} call`;
        }
        return `${callType === 'video' ? 'Video' : 'Audio'} call`;
      } catch (e) {
        // If parsing fails, just let it fall through to text
      }
    }
    return msg.text;
  }
  
  return 'Sent an attachment';
};

export default function Sidebar({ onSelectContact }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const [sentRequests, setSentRequests] = useState([]); 
  const searchTimeout = useRef(null);

  const { 
    inbox, 
    contacts, 
    requests, 
    onlineUsers, 
    loadInbox, 
    loadRequests, 
    loadContacts, 
    acceptRequest, 
    declineRequest, 
    addRequest 
  } = useChatStore();
  
  const { user, logout } = useAuthStore();
  const socket = getSocket();

  useEffect(() => {
    loadInbox();
    loadRequests();
    loadContacts(); 
  }, []);

  useEffect(() => {
    socket.on('request:received', (req) => {
      addRequest(req);
      toast(`New request from @${req.fromUser?.username}`);
    });
    socket.on('request:accepted', () => {
      loadInbox();
      loadContacts(); 
    });
    socket.on('inbox:update', () => loadInbox());

    return () => {
      socket.off('request:received');
      socket.off('request:accepted');
      socket.off('inbox:update');
    };
  }, []);

  const handleSearch = (q) => {
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) {
      setSearchResults([]); 
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
        setSearchResults(res.data); 
      } catch {}
    }, 300);
  };

  const handleAccept = async (requestId, fromUserId) => {
    await acceptRequest(requestId);
    socket.emit('request:accept', { toUserId: fromUserId, fromUserId: user.id });
    toast.success('Accepted');
  };

  const sendRequest = async (toUserId) => {
    try {
      const res = await api.post('/users/request', { toUserId });
      socket.emit('request:send', { ...res.data.request, toUserId });
      setSentRequests(prev => [...prev, toUserId]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const notificationCount = requests?.length || 0;

  const displayList = [...(inbox || [])];
  contacts?.forEach(contact => {
    const isInbox = displayList.some(i => (i.user?._id || i.user?.id) === (contact._id || contact.id));
    if (!isInbox) {
      displayList.push({
        user: contact,
        lastMessage: null,
        unreadCount: 0
      });
    }
  });

  return (
    <div className="flex flex-col h-full w-full md:w-[340px] flex-shrink-0 bg-white border-r border-gray-100">
      <div className="p-5">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Messages</h1>
          <button onClick={() => setShowRequests(v => !v)} className="relative p-2 rounded-full hover:bg-gray-100 transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            {notificationCount > 0 && (
              <span className="absolute 1 top-1 right-1 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                {notificationCount}
              </span>
            )}
          </button>
        </div>
        <input
          className="w-full p-2.5 bg-gray-100 text-gray-900 placeholder-gray-500 text-sm rounded-xl outline-none focus:bg-gray-200 transition"
          placeholder="Search users..."
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {showRequests && requests?.length > 0 && (
        <div className="p-3 border-b bg-blue-50/50">
          <p className="text-xs font-semibold text-gray-500 mb-2 px-2">PENDING REQUESTS</p>
          {requests?.map(req => {
            const reqId = req._id || req.id;
            const fromUserId = req.from?._id || req.from;
            const fromUser = req.fromUser || req.from; 

            return (
              <div key={reqId} className="flex items-center justify-between p-2 bg-white rounded-lg shadow-sm mb-2">
                <div className="flex items-center gap-2">
                  <Avatar user={fromUser} size={32} />
                  <span className="text-sm font-medium">{fromUser?.username}</span>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => handleAccept(reqId, fromUserId)} 
                    className="text-xs bg-[#007AFF] text-white px-3 py-1.5 rounded-full font-medium"
                  >
                    Accept
                  </button>
                  <button 
                    onClick={() => declineRequest(reqId)} 
                    className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full font-medium"
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2">
        {searchQuery ? (
          searchResults?.map(result => {
            
            const inInbox = inbox?.some(i => (i.user?._id || i.user?.id) === result._id);
            const inContacts = contacts?.some(c => (c._id || c.id) === result._id);
            const isFriend = inInbox || inContacts;
            
            const hasSent = sentRequests.includes(result._id);
            
            return (
              <div key={result._id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition">
                <div className="flex items-center gap-3">
                  <Avatar user={result} size={44} />
                  <p className="font-medium text-gray-900">{result.username}</p>
                </div>
                {!isFriend && (
                  <button 
                    disabled={hasSent}
                    onClick={() => sendRequest(result._id)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${hasSent ? 'bg-gray-100 text-gray-400' : 'bg-[#007AFF] text-white'}`}
                  >
                    {hasSent ? 'Sent' : 'Add'}
                  </button>
                )}
              </div>
            )
          })
        ) : (
          displayList?.map(item => {
            const contact = item.user;
            if(!contact) return null;
            return (
              <div
                key={contact._id || contact.id} 
                className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-xl cursor-pointer transition mb-1"
                onClick={() => onSelectContact(contact)}
              >
                <Avatar user={contact} online={onlineUsers.includes(contact._id || contact.id)} size={48} />
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-baseline">
                    <p className="font-semibold text-gray-900 truncate">{contact.username}</p>
                  </div>
                  {/* 🔥 UI FIX: Route the last message through our new decoder */}
                  <p className={`text-sm truncate ${item.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {formatLastMessage(item.lastMessage)}
                  </p>
                </div>
                {item.unreadCount > 0 && (
                  <div className="w-3 h-3 bg-[#007AFF] rounded-full flex-shrink-0" />
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-2">
          <Avatar user={user} size={32} />
          <span className="text-sm font-semibold text-gray-900 truncate max-w-[120px]">{user?.username}</span>
        </div>
        <button onClick={logout} className="text-xs text-red-500 font-medium hover:underline">Logout</button>
      </div>
    </div>
  );
}