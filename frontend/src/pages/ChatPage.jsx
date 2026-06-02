import React, { useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import CallOverlay from "../components/CallOverlay";
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../utils/socket';

export default function ChatPage() {
  const {
    activeContact,
    setActiveContact,
    setOnlineUsers,
    markAsRead,
    addMessage,
    setTyping,
    markMessagesAsSeen
  } = useChatStore();

  const { user } = useAuthStore();
  const socket = getSocket();

  const handleSelectContact = (contact) => {
    setActiveContact(contact);
    
    // 🔥 THE FIX: The Bouncer Check! 
    // If contact is null (like when hitting the back button), stop right here.
    if (!contact) return; 

    const myId = user._id || user.id;
    markAsRead(contact._id || contact.id, myId);
  };

  useEffect(() => {
    if (!user) return;
    const myId = user._id || user.id; 

    const handleConnect = () => {
      socket.emit('user:online', myId);
    };

    socket.on('connect', handleConnect);
    socket.emit('user:online', myId); 

    socket.on('users:online', (users) => setOnlineUsers(users));
    socket.on('typing:start', ({ roomId, userId }) => setTyping(roomId, userId, true));
    socket.on('typing:stop', ({ roomId, userId }) => setTyping(roomId, userId, false));
    
    socket.on('message:new', (msg) => {
      addMessage(msg.roomId, msg);
      
      const currentActive = useChatStore.getState().activeContact;
      
      if (currentActive && msg.roomId.includes(currentActive._id || currentActive.id)) {
        if (msg.sender !== myId && msg.senderId !== myId) {
           markAsRead(currentActive._id || currentActive.id, myId);
        }
      }
    });
    
    socket.on('messages:read:receipt', ({ readerId }) => {
      markMessagesAsSeen(readerId, myId);
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('users:online');
      socket.off('typing:start');
      socket.off('typing:stop');
      socket.off('message:new');
      socket.off('messages:read:receipt');
    };
  }, [user, socket, setOnlineUsers, setTyping, addMessage, markMessagesAsSeen, markAsRead]);

  useEffect(() => {
    if (!activeContact || !user) return;
    const myId = user._id || user.id;
    const contactId = activeContact._id || activeContact.id;
    
    const roomId = [myId, contactId].sort().join('_');
    socket.emit('room:join', roomId);

  }, [activeContact, user, socket]);

  return (
    <div className="h-screen flex overflow-hidden bg-[#F5F7FB]">

      <CallOverlay/>

      {/* SHOW SIDEBAR ON MOBILE ONLY IF NO CHAT IS ACTIVE */}
      <div className={`${activeContact ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full flex-shrink-0`}>
        <Sidebar onSelectContact={handleSelectContact} />
      </div>

      {/* SHOW CHAT WINDOW ON MOBILE ONLY IF A CHAT IS ACTIVE */}
      <div className={`${!activeContact ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0 relative h-full bg-white md:bg-transparent`}>
        {activeContact ? (
          <>
            {/* MOBILE BACK BUTTON */}
            <div className="md:hidden bg-white border-b border-gray-100 px-3 py-2 flex items-center z-30 shadow-sm">
              <button 
                onClick={() => handleSelectContact(null)}
                className="flex items-center text-[#007AFF] font-medium text-sm hover:opacity-70 transition active:scale-95"
              >
                <svg className="w-5 h-5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Chats
              </button>
            </div>
            
            <ChatWindow
              contact={activeContact}
              key={activeContact._id || activeContact.id}
            />
          </>
        ) : (
          <div className="flex-1 items-center justify-center hidden md:flex">
            <div className="text-center">
              <img 
  src="/Logo.png" 
  className="h-12 sm:h-16 md:h-20 aspect-square justify-self-center object-contain transition-all duration-300" 
  alt="Arisun Logo" 
/>
              <h2 className="text-xl font-bold text-gray-900">Start a conversation</h2>
              <p className="text-gray-500 text-sm mt-1">Select a chat from the sidebar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}