import React, { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar';
import Profile from './Profile';
import NotificationPanel from './NotificationPanel'; 
import CreateGroupModal from './CreateGroupModal'; 
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
    const targetPreview = msg.type === 'text' ? ` to: "${msg.text.substring(0, 10)}${msg.text.length > 10 ? '...' : ''}"` : ' to an attachment';
    return `${prefix} ${lastReaction.emoji}${targetPreview}`;
  }

  if (msg.type === 'text') {
    if (msg.text && msg.text.startsWith('📞CALL_LOG::')) {
      try {
        const parsed = JSON.parse(msg.text.replace('📞CALL_LOG::', ''));
        return parsed.status !== 'connected' ? `Missed call` : `Call ended`;
      } catch (e) {}
    }
    return msg.text;
  }
  return 'Sent an attachment';
};

export default function Sidebar({ onSelectContact, activeContact }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false); 
  
  const [myGroups, setMyGroups] = useState([]);

  const [chatToDelete, setChatToDelete] = useState(null);
  const longPressTimer = useRef(null);
  const searchTimeout = useRef(null);

  const { 
    inbox, contacts, requests, onlineUsers, sentRequests,
    loadSentRequests, addSentRequest, removeSentRequest,
    loadInbox, loadRequests, loadContacts, addRequest,
    hiddenChats, hideChat 
  } = useChatStore();
  
  const { user, logout } = useAuthStore();
  const socket = getSocket();

  const fetchGroups = async () => {
    try {
      const res = await api.get('/groups');
      setMyGroups(res.data);
    } catch(e) {
      console.error("Failed to fetch groups", e);
    }
  };

  useEffect(() => {
    loadInbox();
    loadRequests();
    loadContacts(); 
    loadSentRequests();
    fetchGroups(); 
  }, []);

  useEffect(() => {
    // 🔥 THE FIX: Named Handler Functions for targeted cleanup
    const handleRequestReceived = (req) => addRequest(req);
    const handleRequestAccepted = () => { loadInbox(); loadContacts(); loadSentRequests(); };
    const handleRequestDeclined = (data) => removeSentRequest(data.byUserId);
    const handleInboxUpdate = () => loadInbox();
    const handleFriendRemove = () => { loadContacts(); loadInbox(); };
    const handleGroupUpdate = () => fetchGroups(); 

    const handleMessageNew = (msg) => {
      fetchGroups();
      loadInbox(); 
      
      const isActivelyChatting = activeContact && (activeContact._id === msg.sender || activeContact.id === msg.sender || activeContact._id === msg.roomId);
      if (isActivelyChatting || msg.sender === user?.id || msg.sender === user?._id) return;

      let previewText = msg.type === 'text' ? (msg.text.length > 30 ? msg.text.substring(0, 30) + '...' : msg.text) : `📸 ${msg.type}`;
      
      let senderName = 'Someone';
      const groupFound = myGroups.find(g => g._id === msg.roomId);
      let senderContact = null;

      if (groupFound) {
        senderName = groupFound.chatName; 
      } else {
        senderContact = contacts?.find(c => (c._id || c.id) === msg.sender) || inbox?.find(i => (i.user?._id || i.user?.id) === msg.sender)?.user;
        senderName = senderContact?.username || 'Someone';
      }

      const targetUser = groupFound || senderContact || { username: senderName };

      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 cursor-pointer`}
             onClick={() => {
                if(groupFound) onSelectContact(groupFound);
                else {
                  const sContact = contacts?.find(c => (c._id || c.id) === msg.sender);
                  if (sContact) onSelectContact(sContact);
                }
                toast.dismiss(t.id);
               }}>
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <Avatar user={targetUser} size={40} className="pointer-events-none" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-bold text-gray-900">{senderName}</p>
                <p className="mt-1 text-sm text-gray-500">{previewText}</p>
              </div>
            </div>
          </div>
        </div>
      ), { duration: 4000, position: 'top-right' });
    };

    // Attach listeners
    socket.on('request:received', handleRequestReceived);
    socket.on('request:accepted', handleRequestAccepted);
    socket.on('request:declined', handleRequestDeclined);
    socket.on('inbox:update', handleInboxUpdate);
    socket.on('friend:remove', handleFriendRemove);
    socket.on('group:update', handleGroupUpdate);
    socket.on('message:new', handleMessageNew);

    // 🔥 THE FIX: Targeted cleanup prevents ChatWindow assassination
    return () => {
      socket.off('request:received', handleRequestReceived);
      socket.off('request:accepted', handleRequestAccepted);
      socket.off('request:declined', handleRequestDeclined);
      socket.off('inbox:update', handleInboxUpdate);
      socket.off('friend:remove', handleFriendRemove);
      socket.off('group:update', handleGroupUpdate);
      socket.off('message:new', handleMessageNew);
    };
  }, [activeContact, contacts, inbox, user, onSelectContact, addRequest, loadInbox, loadContacts, loadSentRequests, removeSentRequest, myGroups]);

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

  const sendRequest = async (toUserId) => {
    try {
      const res = await api.post('/users/request', { toUserId });
      socket.emit('request:send', { ...res.data.request, toUserId });
      addSentRequest(toUserId);
      toast.success('Friend request sent!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleTouchStart = (contactItem) => {
    longPressTimer.current = setTimeout(() => setChatToDelete(contactItem), 650); 
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const executeDeleteChat = () => {
    if (!chatToDelete) return;
    const contactId = chatToDelete._id || chatToDelete.id;
    hideChat(contactId);
    toast.success('Chat hidden from sidebar');
    setChatToDelete(null);
  };

  const finalRenderList = [
    ...myGroups.map(g => ({ type: 'group', data: g, updatedAt: new Date(g.updatedAt || 0) })),
    ...inbox
        .filter(item => item && item.user)
        .map(i => ({ type: 'dm', data: i.user, lastMessage: i.lastMessage, unreadCount: i.unreadCount, updatedAt: new Date(i.lastMessage?.createdAt || i.updatedAt || 0) }))
  ]
  .filter(item => {
    if (!item.data) return false; 
    const id = item.type === 'group' ? item.data._id : (item.data._id || item.data.id);
    return !hiddenChats.includes(id);
  })
  .sort((a, b) => b.updatedAt - a.updatedAt);

  const searchGroups = myGroups.filter(g => g.chatName.toLowerCase().includes(searchQuery.toLowerCase()));
  const notificationCount = requests?.length || 0;

  return (
    <>
      {showGroupModal && <CreateGroupModal onClose={() => setShowGroupModal(false)} onSuccess={fetchGroups} />}

      {showLogoutModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#f2f2f2] rounded-[18px] w-full max-w-[270px] flex flex-col overflow-hidden text-center shadow-xl scale-in-center">
            <div className="p-5 pb-4">
              <h3 className="font-semibold text-[17px] tracking-tight text-black leading-tight">Log Out</h3>
              <p className="text-[13px] text-gray-500 mt-1 leading-tight">Are you sure you want to log out of Arisun Chat?</p>
            </div>
            <div className="flex border-t border-gray-300/80">
              <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-3 text-[17px] font-normal text-[#007AFF] hover:bg-gray-200/50 transition">Cancel</button>
              <div className="w-[1px] bg-gray-300/80" />
              <button onClick={() => { setShowLogoutModal(false); logout(); }} className="flex-1 py-3 text-[17px] font-semibold text-[#FF3B30] hover:bg-red-50/50 transition">Log Out</button>
            </div>
          </div>
        </div>
      )}

      {chatToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#f2f2f2] rounded-[18px] w-full max-w-[280px] flex flex-col overflow-hidden text-center shadow-xl scale-in-center">
            <div className="p-5 pb-4">
              <h3 className="font-semibold text-[17px] tracking-tight text-black leading-tight">Delete Chat?</h3>
              <p className="text-[13px] text-gray-500 mt-1 leading-tight">Are you sure you want to Delete this? This has no effect on chat history.</p>
            </div>
            <div className="flex border-t border-gray-300/80">
              <button onClick={() => setChatToDelete(null)} className="flex-1 py-3 text-[17px] font-normal text-[#007AFF] hover:bg-gray-200/50 transition">Cancel</button>
              <div className="w-[1px] bg-gray-300/80" />
              <button onClick={executeDeleteChat} className="flex-1 py-3 text-[17px] font-semibold text-[#FF3B30] hover:bg-red-50/50 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col h-full w-full md:w-[340px] flex-shrink-0 bg-white border-r border-gray-100 relative">
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Messages</h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowGroupModal(true)} className="p-2 rounded-full hover:bg-gray-100 transition text-[#007AFF]" title="New Group">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <button onClick={() => setShowRequests(v => !v)} className="relative p-2 rounded-full hover:bg-gray-100 transition">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                {notificationCount > 0 && <span className="absolute 1 top-1 right-1 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">{notificationCount}</span>}
              </button>
            </div>
          </div>
          <input
            className="w-full p-2.5 bg-gray-100 text-gray-900 placeholder-gray-500 text-sm rounded-xl outline-none focus:bg-gray-200 transition"
            placeholder="Search users or groups..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>

        {showRequests && <NotificationPanel onClose={() => setShowRequests(false)} onSelectContact={onSelectContact} />}

        <div className="flex-1 overflow-y-auto px-2">
          {searchQuery ? (
            <>
              {searchGroups.map(group => (
                <div key={group._id} onClick={() => { onSelectContact(group); setSearchQuery(''); }} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Avatar user={group} size={44} />
                    <div>
                      <p className="font-medium text-gray-900">{group.chatName}</p>
                      <p className="text-xs text-gray-500">Group • {group.users?.length} members</p>
                    </div>
                  </div>
                </div>
              ))}
              {searchResults?.map(result => {
                const isFriend = contacts?.some(c => (c._id || c.id) === result._id);
                const hasSent = sentRequests.includes(result._id);

                return (
                  <div key={result._id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition">
                    <div className="flex items-center gap-3">
                      <Avatar user={result} size={44} />
                      <p className="font-medium text-gray-900">{result.username}</p>
                    </div>
                    {isFriend ? (
                       <button onClick={() => { onSelectContact(result); setSearchQuery(''); }} className="text-xs bg-gray-100 text-gray-700 px-4 py-1.5 rounded-full font-bold hover:bg-gray-200 transition">Chat</button>
                    ) : (
                       <button disabled={hasSent} onClick={() => sendRequest(result._id)} className={`text-xs px-4 py-1.5 rounded-full font-bold transition ${hasSent ? 'bg-gray-100 text-gray-400' : 'bg-[#007AFF] text-white'}`}>{hasSent ? 'Sent' : 'Add'}</button>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            finalRenderList.map((item) => {
              if (item.type === 'group') {
                const group = item.data;
                return (
                  <div key={group._id} onClick={() => onSelectContact(group)} className="group flex items-center gap-3 p-3 hover:bg-gray-100 rounded-xl cursor-pointer transition mb-1 relative touch-manipulation">
                    <Avatar user={group} size={48} />
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-baseline">
                        <p className="font-semibold text-gray-900 truncate">{group.chatName}</p>
                      </div>
                      <p className="text-sm truncate text-gray-500">
                        {formatLastMessage(item.lastMessage || group.latestMessage, user?._id || user?.id)}
                      </p>
                    </div>
                  </div>
                );
              }

              const contact = item.data;
              if (!contact) return null;
              
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
                  {item.unreadCount > 0 && <div className="w-3 h-3 bg-[#007AFF] rounded-full flex-shrink-0" />}
                  <button onClick={(e) => { e.stopPropagation(); setChatToDelete(contact); }} className="absolute right-4 bg-red-50 text-red-600 hover:bg-red-100 text-[11px] font-bold px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm">Delete</button>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t flex justify-between items-center bg-gray-50">
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-2 hover:opacity-70 transition text-left">
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