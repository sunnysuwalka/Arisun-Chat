import React, { useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import CallOverlay from "../components/CallOverlay";
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast'; 

// 🔥 Import E2EE Decryption for Toast Previews
import { decryptMessage } from '../utils/crypto';

export default function ChatPage() {
  const {
    activeContact,
    setActiveContact,
    setOnlineUsers,
    markAsRead,
    addMessage,
    setTyping,
    markMessagesAsSeen,
    contacts, // 🔥 Extracted here to ensure hydration
    inbox     // 🔥 Extracted here to ensure hydration
  } = useChatStore();

  const { user, privateKeys } = useAuthStore();
  const socket = getSocket();

  // Hardware Back-Button Interceptor
  useEffect(() => {
    const handlePopState = () => {
      if (activeContact) {
        setActiveContact(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeContact, setActiveContact]);

  const handleSelectContact = (contact) => {
    if (contact) {
      if (!activeContact) {
        window.history.pushState({ chatOpen: true }, '');
      } else {
        window.history.replaceState({ chatOpen: true }, '');
      }
      
      setActiveContact(contact);
      const myId = user._id || user.id;
      markAsRead(contact._id || contact.id, myId);
      
    } else {
      if (activeContact) {
        window.history.back();
      }
    }
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
    
    // 🔥 THE FIX: The Crash-Proof Master Listener with Premium Toast UI
    socket.on('message:new', (msg) => {
      const senderId = msg.sender || msg.senderId;
      const isMine = senderId === myId;
      
      // 1. Calculate the Room ID dynamically since the backend doesn't provide it
      const messageRoomId = msg.roomId || [myId, senderId].sort().join('_');
      
      // 2. Safely add the message to the correct thread
      addMessage(messageRoomId, msg);
      
      const state = useChatStore.getState();
      const currentActive = state.activeContact;
      const activeRoomId = currentActive ? [myId, (currentActive._id || currentActive.id)].sort().join('_') : null;

      // 3. The Bouncer Logic
      if (activeRoomId && messageRoomId === activeRoomId) {
        // User A is actively looking at the person who sent the message
        if (!isMine) {
           markAsRead(currentActive._id || currentActive.id, myId);
        }
      } else if (!isMine) {
        // User A is NOT looking at the chat where the message originated. Fire the Toast!
        const latestContacts = state.contacts || contacts || [];
        const latestInbox = state.inbox || inbox || [];
        
        const senderObj = latestContacts.find(c => (c._id || c.id) === senderId) 
                       || latestInbox.find(i => (i.user?._id || i.user?.id) === senderId)?.user;
                       
        const senderName = senderObj?.username || 'New Message';
        
        let previewText = 'Sent a message';
        
        if (msg.type === 'text') {
            // 🔥 THE FIX: Decrypt it! We removed the length check so all messages decrypt
            if (msg.text && privateKeys && senderObj?.publicKey) {
                const decrypted = decryptMessage(msg.text, privateKeys, senderObj.publicKey, senderObj.signPublicKey, false);
                // Clean up the text if it's too long for a toast
                previewText = decrypted.substring(0, 40) + (decrypted.length > 40 ? '...' : '');
            } else {
                // Failsafe if keys haven't loaded
                previewText = 'Encrypted Message 🔒';
            }
        } else if (msg.type === 'image') {
            previewText = 'Sent a Photo 📷';
        } else if (msg.type === 'video') {
            previewText = 'Sent a Video 🎥';
        } else if (msg.type === 'audio') {
            previewText = 'Sent a Voice Message 🎤';
        } else if (msg.type === 'file') {
            previewText = 'Sent an Attachment 📎';
        }
        
        if (msg.text && msg.text.startsWith('📞CALL_LOG::')) previewText = 'Incoming Call...';
        
        // Render the Premium Native Toast Notification
        toast.custom((t) => (
          <div 
            onClick={() => {
              toast.dismiss(t.id);
              if (senderObj) {
                window.history.pushState({ chatOpen: true }, '');
                state.setActiveContact(senderObj);
                markAsRead(senderObj._id || senderObj.id, myId);
              }
            }}
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-[340px] w-full bg-white/95 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100/50 rounded-[20px] pointer-events-auto flex items-center p-3 cursor-pointer transition-all active:scale-[0.98] hover:bg-gray-50`}
          >
            {/* Sender Avatar Initial */}
            <div className="h-[42px] w-[42px] flex-shrink-0 rounded-full overflow-hidden border border-gray-200 bg-gradient-to-tr from-[#007AFF] to-blue-400 flex items-center justify-center text-white font-semibold text-lg">
              {senderObj?.avatar ? (
                <img src={senderObj.avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                senderName.charAt(0).toUpperCase()
              )}
            </div>
            
            {/* Text Payload */}
            <div className="ml-3 flex-1 overflow-hidden pr-2">
              <p className="text-[14px] font-bold text-gray-900 truncate leading-tight">
                {senderName}
              </p>
              <p className="text-[13px] text-gray-500 truncate mt-[2px] leading-tight">
                {previewText}
              </p>
            </div>
          </div>
        ), {
           id: `msg-${senderId}`, // Prevents spamming duplicate toasts from the same person
           position: 'top-left', 
           duration: 4000
        });
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
  }, [user, socket, setOnlineUsers, setTyping, addMessage, markMessagesAsSeen, markAsRead, privateKeys, contacts, inbox]);

  useEffect(() => {
    if (!activeContact || !user) return;
    const myId = user._id || user.id;
    const contactId = activeContact._id || activeContact.id;
    
    const roomId = [myId, contactId].sort().join('_');
    socket.emit('room:join', roomId);

  }, [activeContact, user, socket]);

  return (
    <div className="fixed inset-0 h-[100dvh] w-full flex overflow-hidden bg-[#F5F7FB]">
      
      <CallOverlay/>

      <div className={`${activeContact ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full flex-shrink-0`}>
        <Sidebar onSelectContact={handleSelectContact} />
      </div>

      <div className={`${!activeContact ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0 relative h-full bg-white md:bg-transparent`}>
        {activeContact ? (
          <>
            <div className="md:hidden flex-shrink-0 bg-white border-b border-gray-100 px-3 py-2 flex items-center z-30 shadow-sm">
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