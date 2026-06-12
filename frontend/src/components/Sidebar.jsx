import React, { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar';
import Profile from './Profile';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { getSocket } from '../utils/socket';

const formatLastMessage = (msg, myId) => {
  if (!msg) return 'Start chatting';
  
  if (msg.reactions && msg.reactions.length > 0) {
    const lastReaction = msg.reactions[msg.reactions.length - 1];
    const isMyReaction = lastReaction.userId === myId;
    const prefix = isMyReaction ? 'You reacted' : 'Reacted';
    
    const targetPreview = msg.type === 'text' 
      ? ` to: "${msg.text.substring(0, 10)}${msg.text.length > 10 ? '...' : ''}"`
      : ' to an attachment';

    return `${prefix} ${lastReaction.emoji}${targetPreview}`;
  }

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
        // Fall through
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
  const [showProfile, setShowProfile] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  const [chatToDelete, setChatToDelete] = useState(null);
  const longPressTimer = useRef(null);
  
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
    addRequest,
    hiddenChats, 
    hideChat 
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

    socket.on('friend:remove', () => {
      loadContacts();
      loadInbox();
    });

    return () => {
      socket.off('request:received');
      socket.off('request:accepted');
      socket.off('inbox:update');
      socket.off('friend:remove');
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

  const handleTouchStart = (contactItem) => {
    longPressTimer.current = setTimeout(() => {
      setChatToDelete(contactItem);
    }, 650); 
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const executeDeleteChat = () => {
    if (!chatToDelete) return;
    
    const contactId = chatToDelete._id || chatToDelete.id;
    hideChat(contactId);
    toast.success('Chat removed from sidebar');
    setChatToDelete(null);
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

  const visibleList = displayList.filter(item => {
    const id = item.user?._id || item.user?.id;
    return !hiddenChats.includes(id);
  });

  return (
    <>
      {showLogoutModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#f2f2f2] rounded-[18px] w-full max-w-[270px] flex flex-col overflow-hidden text-center shadow-xl scale-in-center">
            <div className="p-5 pb-4">
              <h3 className="font-semibold text-[17px] tracking-tight text-black leading-tight">
                Log Out
              </h3>
              <p className="text-[13px] text-gray-500 mt-1 leading-tight">
                Are you sure you want to log out of Arisun Chat?
              </p>
            </div>
            <div className="flex border-t border-gray-300/80">
              <button 
                onClick={() => setShowLogoutModal(false)} 
                className="flex-1 py-3 text-[17px] font-normal text-[#007AFF] hover:bg-gray-200/50 transition active:bg-gray-300/50"
              >
                Cancel
              </button>
              <div className="w-[1px] bg-gray-300/80" />
              <button 
                onClick={() => {
                  setShowLogoutModal(false);
                  logout();
                }} 
                className="flex-1 py-3 text-[17px] font-semibold text-[#FF3B30] hover:bg-red-50/50 transition active:bg-red-100/50"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {chatToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#f2f2f2] rounded-[18px] w-full max-w-[280px] flex flex-col overflow-hidden text-center shadow-xl scale-in-center">
            <div className="p-5 pb-4">
              <h3 className="font-semibold text-[17px] tracking-tight text-black leading-tight">
                Delete Chat?
              </h3>
              <p className="text-[13px] text-gray-500 mt-1 leading-tight">
                Are you sure you want to delete? This has no effects on your chat history.
              </p>
            </div>
            <div className="flex border-t border-gray-300/80">
              <button 
                onClick={() => setChatToDelete(null)} 
                className="flex-1 py-3 text-[17px] font-normal text-[#007AFF] hover:bg-gray-200/50 transition active:bg-gray-300/50"
              >
                Cancel
              </button>
              <div className="w-[1px] bg-gray-300/80" />
              <button 
                onClick={executeDeleteChat} 
                className="flex-1 py-3 text-[17px] font-semibold text-[#FF3B30] hover:bg-red-50/50 transition active:bg-red-100/50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col h-full w-full md:w-[340px] flex-shrink-0 bg-white border-r border-gray-100 relative">
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
              // 🔥 THE FIX: Find the perfectly populated object from the local memory
              const existingContactItem = displayList.find(item => (item.user?._id || item.user?.id) === result._id);
              
              const isFriend = !!existingContactItem || contacts?.some(c => (c._id || c.id) === result._id);
              const hasSent = sentRequests.includes(result._id);
              
              // If they are a friend, use the fully populated local object so decryption keys never fail
              const targetContact = existingContactItem ? existingContactItem.user : result;

              return (
                <div key={result._id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition">
                  <div className="flex items-center gap-3">
                    <Avatar user={targetContact} size={44} />
                    <p className="font-medium text-gray-900">{targetContact.username}</p>
                  </div>
                  
                  {isFriend ? (
                    <button 
                      onClick={() => {
                        onSelectContact(targetContact); // Passes the identical, key-rich object to ChatWindow
                        setSearchQuery('');
                      }}
                      className="text-xs bg-gray-100 text-gray-700 px-4 py-1.5 rounded-full font-bold hover:bg-gray-200 transition"
                    >
                      Chat
                    </button>
                  ) : (
                    <button 
                      disabled={hasSent}
                      onClick={() => sendRequest(result._id)}
                      className={`text-xs px-4 py-1.5 rounded-full font-bold transition ${hasSent ? 'bg-gray-100 text-gray-400' : 'bg-[#007AFF] text-white'}`}
                    >
                      {hasSent ? 'Sent' : 'Add'}
                    </button>
                  )}
                </div>
              )
            })
          ) : (
            visibleList?.map(item => {
              const contact = item.user;
              if(!contact) return null;
              
              return (
                <div
                  key={contact._id || contact.id} 
                  className="group flex items-center gap-3 p-3 hover:bg-gray-100 rounded-xl cursor-pointer transition mb-1 relative touch-manipulation"
                  onClick={() => onSelectContact(contact)}
                  onMouseDown={() => handleTouchStart(contact)}
                  onMouseUp={handleTouchEnd}
                  onTouchStart={() => handleTouchStart(contact)}
                  onTouchEnd={handleTouchEnd}
                >
                  <Avatar user={contact} online={onlineUsers.includes(contact._id || contact.id)} size={48} />
                  
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-baseline">
                      <p className="font-semibold text-gray-900 truncate">{contact.username}</p>
                    </div>
                    <p className={`text-sm truncate ${item.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                      {formatLastMessage(item.lastMessage, user?._id || user?.id)}
                    </p>
                  </div>
                  
                  {item.unreadCount > 0 && (
                    <div className="w-3 h-3 bg-[#007AFF] rounded-full flex-shrink-0" />
                  )}

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setChatToDelete(contact);
                    }}
                    className="absolute right-4 bg-red-50 text-red-600 hover:bg-red-100 text-[11px] font-bold px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm"
                  >
                    Delete
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t flex justify-between items-center bg-gray-50">
          <button 
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 hover:opacity-70 transition text-left"
          >
            <Avatar user={user} size={32} />
            <span className="text-sm font-semibold text-gray-900 truncate max-w-[120px]">{user?.username}</span>
          </button>
          <button onClick={() => setShowLogoutModal(true)} className="text-xs text-red-500 font-medium hover:underline">Logout</button>
        </div>

        {showProfile && <Profile onClose={() => setShowProfile(false)} />}
      </div>
    </>
  );
}