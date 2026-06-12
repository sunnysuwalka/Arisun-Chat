import React, { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar';
import MessageBubble from './MessageBubble';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../utils/socket';
import api from '../utils/api';
import toast from 'react-hot-toast';

// 🔥 Import the new E2EE Crypto Engine
import { encryptMessage, decryptMessage } from '../utils/crypto';

const formatSec = (sec) => {
  if (isNaN(sec) || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function ChatWindow({ contact }) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null); 
  const [requestSent, setRequestSent] = useState(false); // 🔥 For the new Add Friend button

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Scroll & Unread Tracking States
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isScrolledUpRef = useRef(false);
  const chatContainerRef = useRef(null);

  // Pagination States
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const previousScrollHeightRef = useRef(0);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const menuRef = useRef(null);

  // 🔥 Extracted `contacts` to enforce the UI Lock
  const { messages, loadMessages, typingUsers, loadContacts, loadInbox, removeMessage, updateMessage, setActiveContact, setCallState, hasMore, roomPages, contacts } = useChatStore();
  
  const { user, privateKeys } = useAuthStore();
  const socket = getSocket();

  const myId = user?._id || user?.id || user?.userId;
  const contactId = contact?._id || contact?.id;
  const roomId = [myId, contactId].sort().join('_');
  const roomMessages = messages[roomId] || [];

  const isOnline = useChatStore(s => s.onlineUsers.includes(contactId));
  const isTyping = (typingUsers[roomId] || []).includes(contactId);
  
  // 🔥 THE LOCK: Check if they are still friends
  const isFriend = contacts?.some(c => (c._id || c.id) === contactId);

  useEffect(() => {
    setIsScrolledUp(false);
    isScrolledUpRef.current = false;
    setUnreadCount(0);
  }, [roomId]);

  useEffect(() => {
    if (!contact || !myId) return;
    
    const joinRoom = () => socket.emit('room:join', roomId);
    
    joinRoom();
    loadMessages(roomId, 1); 
    setEditingMessage(null);
    setReplyingTo(null);
    setText('');
    setRequestSent(false); // Reset request state on chat change
    cancelRecording();

    socket.on('connect', joinRoom);

    return () => {
      socket.off('connect', joinRoom);
    };
  }, [contactId, roomId, myId, socket, loadMessages]);

  const handleScroll = async () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    
    if (scrollTop === 0 && hasMore[roomId] && !isLoadingOlder) {
      setIsLoadingOlder(true);
      previousScrollHeightRef.current = scrollHeight; 
      const nextPage = (roomPages[roomId] || 1) + 1;
      await loadMessages(roomId, nextPage);
      setIsLoadingOlder(false);
    }

    const isUp = scrollHeight - scrollTop - clientHeight > 150;

    if (isScrolledUpRef.current !== isUp) {
      isScrolledUpRef.current = isUp;
      setIsScrolledUp(isUp);
    }

    if (!isUp && unreadCount > 0) {
      setUnreadCount(0);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0);
    setIsScrolledUp(false);
    isScrolledUpRef.current = false;
  };

  const prevMsgCount = useRef(roomMessages.length);

  useEffect(() => {
    if (previousScrollHeightRef.current > 0 && chatContainerRef.current) {
      const newScrollHeight = chatContainerRef.current.scrollHeight;
      chatContainerRef.current.scrollTop = newScrollHeight - previousScrollHeightRef.current;
      previousScrollHeightRef.current = 0; 
      prevMsgCount.current = roomMessages.length; 
      return; 
    }

    const isNewMessage = roomMessages.length > prevMsgCount.current;

    if (isNewMessage) {
      const latestMsg = roomMessages[roomMessages.length - 1];
      if (latestMsg) {
        const isMine = latestMsg.sender === myId || latestMsg.senderId === myId;

        if (isMine || !isScrolledUpRef.current) {
          setTimeout(() => scrollToBottom(), 50); 
        } else {
          setUnreadCount(prev => prev + 1);
        }
      }
    } else if (isTyping && !isScrolledUpRef.current) {
      setTimeout(() => scrollToBottom(), 50);
    }

    prevMsgCount.current = roomMessages.length;
  }, [roomMessages.length, isTyping, myId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTextChange = (e) => {
    setText(e.target.value);
    socket.emit('typing:start', { roomId, userId: myId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { roomId, userId: myId });
    }, 2000);
  };

  // 🔥 RESTORE CONNECTION: New Add Friend function for the locked state
  const handleSendRequest = async () => {
    try {
      const res = await api.post('/users/request', { toUserId: contactId });
      socket.emit('request:send', { ...res.data.request, toUserId: contactId });
      setRequestSent(true);
      toast.success('Friend request sent!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send request');
    }
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!text.trim() || !isFriend) return;

    if (!privateKeys) {
      toast.error("Vault is locked! Please re-login to send messages.");
      return;
    }

    let encryptedText = text.trim();

    if (contact.publicKey && user.publicKey) {
      try {
        encryptedText = encryptMessage(
          encryptedText,
          privateKeys,
          contact.publicKey, 
          user.publicKey 
        );
      } catch (err) {
        toast.error('Encryption Engine Failure');
        console.error(err);
        return;
      }
    }

    if (editingMessage) {
      try {
        const msgId = editingMessage._id || editingMessage.id;
        const res = await api.put(`/chat/message/${msgId}`, { text: encryptedText });
        updateMessage(roomId, msgId, { text: res.data.text, edited: true });
        setEditingMessage(null);
        setText('');
      } catch {
        toast.error('Failed to update message');
      }
      return;
    }

    socket.emit('message:send', {
      roomId,
      message: { 
        text: encryptedText, 
        type: 'text', 
        sender: myId,
        replyTo: replyingTo ? (replyingTo._id || replyingTo.id) : null 
      }
    });

    setText('');
    setReplyingTo(null); 
    socket.emit('typing:stop', { roomId, userId: myId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !isFriend) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload/file', fd);

      socket.emit('message:send', {
        roomId,
        message: { 
          type: res.data.type, 
          url: res.data.url, 
          sender: myId,
          replyTo: replyingTo ? (replyingTo._id || replyingTo.id) : null 
        }
      });
      setReplyingTo(null);
    } catch {
      toast.error('Upload failed');
    }
    setUploading(false);
    fileInputRef.current.value = '';
  };

  const startRecording = async () => {
    if (!isFriend) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error('Microphone access denied');
    }
  };

  const stopTracks = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null; 
      mediaRecorderRef.current.stop();
    }
    stopTracks();
  };

  const sendRecording = () => {
    if (!mediaRecorderRef.current || !isFriend) return;
    
    mediaRecorderRef.current.onstop = async () => {
      stopTracks();
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', audioBlob, `voice_${Date.now()}.wav`);
        const res = await api.post('/upload/file', fd);

        socket.emit('message:send', {
          roomId,
          message: { 
            type: res.data.type, 
            url: res.data.url, 
            sender: myId,
            replyTo: replyingTo ? (replyingTo._id || replyingTo.id) : null 
          }
        });
        setReplyingTo(null);
      } catch {
        toast.error('Failed to send voice message');
      }
      setUploading(false);
    };

    mediaRecorderRef.current.stop();
  };

  const requestDeleteMessage = (msgId) => {
    setConfirmAction({
      type: 'delete_msg', payload: msgId, title: 'Delete Message?',
      description: 'This action cannot be undone.', confirmText: 'Delete', confirmColor: 'text-[#FF3B30]'
    });
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, payload } = confirmAction;

    try {
      if (type === 'delete_msg') {
        await api.delete(`/chat/message/${payload}`);
        removeMessage(roomId, payload);
        toast.success('Message deleted');
      } 
      else if (type === 'clear_chat') {
        await api.delete(`/chat/clear/${roomId}`);
        loadMessages(roomId, 1);
        toast.success('Chat cleared');
      } 
      else if (type === 'remove_friend') {
        await api.post('/users/remove', { userId: contactId });
        
        // 🔥 Real-time emit to lock User B's UI
        socket.emit('friend:remove', { userId: contactId }); 
        
        toast.success('Friend removed');
        loadContacts();
        loadInbox();
        // Notice we do NOT run `setActiveContact(null)` here anymore. The chat stays open but instantly locks!
      } 
      else if (type === 'block_user') {
        await api.post('/users/block', { userId: contactId });
        socket.emit('friend:remove', { userId: contactId }); 
        toast.success('User blocked');
        loadContacts();
        loadInbox();
      }
    } catch {
      toast.error(`Failed to execute action`);
    }
    setConfirmAction(null);
  };

  const triggerEdit = (msg) => {
    if (!isFriend) return;
    setEditingMessage(msg);
    setText(msg.text); 
  };

  const handleReact = async (msgId, emoji) => {
    if (!isFriend) return;
    try {
      const res = await api.post('/chat/react', { messageId: msgId, emoji });
      updateMessage(roomId, msgId, { reactions: res.data.reactions });
    } catch {
      toast.error('Failed to add reaction');
    }
  };

  // 🔥 THE FIX: Corrected cryptographic shared-secret mapping
  const decryptedMessages = roomMessages.map(msg => {
    let displayMsg = { ...msg };
    const isMine = displayMsg.sender === myId || displayMsg.senderId === myId;
    
    if (
      displayMsg.type === 'text' && 
      displayMsg.text && 
      !displayMsg.text.startsWith('📞CALL_LOG::') && 
      privateKeys
    ) {
      const targetEncPubKey = contact.publicKey; 
      const targetSignPubKey = isMine ? user.signPublicKey : contact.signPublicKey;
      
      if (targetEncPubKey && targetSignPubKey) {
        try {
          displayMsg.text = decryptMessage(
            displayMsg.text, 
            privateKeys, 
            targetEncPubKey, 
            targetSignPubKey, 
            isMine
          );
        } catch (err) {
          displayMsg.text = "🔒 [Decryption Error]";
        }
      }
    }
    return displayMsg;
  });

  let lastSeenMsgId = null;
  for (let i = decryptedMessages.length - 1; i >= 0; i--) {
    const m = decryptedMessages[i];
    if ((m.sender === myId || m.senderId === myId) && m.seen) {
      lastSeenMsgId = m._id || m.id;
      break;
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#F8FAFC] relative">
      
      {/* CONFIRMATION MODAL */}
      {confirmAction && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/20 p-4 animate-fade-in">
          <div className="bg-[#f2f2f2] rounded-[18px] w-full max-w-[270px] flex flex-col overflow-hidden text-center shadow-xl scale-in-center">
            <div className="p-5 pb-4">
              <h3 className="font-semibold text-[17px] tracking-tight text-black leading-tight">
                {confirmAction.title}
              </h3>
              <p className="text-[13px] text-gray-500 mt-1 leading-tight">
                {confirmAction.description}
              </p>
            </div>
            <div className="flex border-t border-gray-300/80">
              <button 
                onClick={() => setConfirmAction(null)} 
                className="flex-1 py-3 text-[17px] font-normal text-[#007AFF] hover:bg-gray-200/50 transition active:bg-gray-300/50"
              >
                Cancel
              </button>
              <div className="w-[1px] bg-gray-300/80" />
              <button 
                onClick={executeConfirmAction} 
                className={`flex-1 py-3 text-[17px] font-normal hover:bg-gray-200/50 transition active:bg-gray-300/50 ${confirmAction.confirmColor}`}
              >
                {confirmAction.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 bg-white border-b flex justify-between items-center z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          <Avatar user={contact} size={42} online={isOnline} />
          <div>
            <h2 className="font-semibold text-gray-900 text-sm sm:text-base">{contact.username}</h2>
            <p className={`text-[11px] sm:text-xs ${isOnline ? 'text-emerald-500 font-medium' : 'text-gray-400'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* 🔥 THE LOCK: Hide calls if not friends */}
          {isFriend && (
            <>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  setCallState({ isInitiator: true, isReceivingCall: false, isCallAccepted: false, callType: 'audio', to: contactId });
                }} 
                className="text-[#007AFF] hover:opacity-70 transition p-1.5 sm:p-1"
              >
                <PhoneIcon />
              </button>
              
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  setCallState({ isInitiator: true, isReceivingCall: false, isCallAccepted: false, callType: 'video', to: contactId });
                }} 
                className="text-[#007AFF] hover:opacity-70 transition p-1.5 sm:p-1"
              >
                <VideoIcon />
              </button>
            </>
          )}
          
          <div className="relative" ref={menuRef}>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`p-1.5 sm:p-1 transition ${isMenuOpen ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
              <MoreIcon />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-xl py-2 z-50 overflow-hidden">
                <button onClick={() => { setIsMenuOpen(false); setConfirmAction({ type: 'clear_chat', title: 'Clear Chat?', description: 'This will remove all messages for you.', confirmText: 'Clear', confirmColor: 'text-[#FF3B30]' }); }} className="w-full text-left px-4 py-2.5 text-[14px] sm:text-[15px] text-gray-700 hover:bg-gray-50 transition">Clear Chat</button>
                {isFriend && (
                  <button onClick={() => { setIsMenuOpen(false); setConfirmAction({ type: 'remove_friend', title: 'Remove Friend?', description: `Remove ${contact.username} from friends?`, confirmText: 'Remove', confirmColor: 'text-[#FF3B30]' }); }} className="w-full text-left px-4 py-2.5 text-[14px] sm:text-[15px] text-[#FF3B30] hover:bg-red-50 transition">Remove Friend</button>
                )}
                <div className="h-[1px] bg-gray-100 my-1 mx-4" />
                <button onClick={() => { setIsMenuOpen(false); setConfirmAction({ type: 'block_user', title: 'Block User?', description: `They will not be able to message you.`, confirmText: 'Block', confirmColor: 'text-[#FF3B30] font-bold' }); }} className="w-full text-left px-4 py-2.5 text-[14px] sm:text-[15px] font-medium text-[#FF3B30] hover:bg-red-50 transition">Block User</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MESSAGES */}
      <div 
        ref={chatContainerRef} 
        onScroll={handleScroll} 
        className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col"
      >
        {isLoadingOlder && (
          <div className="flex justify-center py-2 animate-fade-in">
            <div className="w-5 h-5 border-2 border-[#007AFF]/30 border-t-[#007AFF] rounded-full animate-spin" />
          </div>
        )}

        {decryptedMessages.map((msg, i) => (
          <MessageBubble
            key={msg._id || i}
            message={msg}
            isMine={msg.sender === myId || msg.senderId === myId}
            isLastSeen={(msg._id || msg.id) === lastSeenMsgId}
            repliedToMessage={msg.replyTo ? decryptedMessages.find(m => (m._id || m.id) === msg.replyTo) : null}
            onReply={() => setReplyingTo(msg)}
            onDelete={() => requestDeleteMessage(msg._id || msg.id)}
            onEdit={() => triggerEdit(msg)}
            onReact={(emoji) => handleReact(msg._id || msg.id, emoji)}
          />
        ))}

        {isTyping && isFriend && (
          <div className="flex mb-3 justify-start animate-fade-in">
            <div className="max-w-[85%] sm:max-w-[75%] flex flex-col relative">
              <div className="px-4 py-3 bg-white border border-gray-100 shadow-sm rounded-[20px] rounded-bl-sm flex gap-1.5 items-center h-[42px] w-[64px]">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* FLOATING SCROLL-TO-BOTTOM BUTTON */}
      {isScrolledUp && (
        <div className="absolute right-4 sm:right-6 bottom-[85px] sm:bottom-[95px] z-30 animate-fade-in">
          <button
            onClick={scrollToBottom}
            className="w-10 h-10 bg-white border border-gray-200 shadow-xl rounded-full flex items-center justify-center text-[#007AFF] hover:bg-blue-50 transition active:scale-95 relative"
          >
            <DownArrowIcon />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#FF3B30] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* INPUT OR LOCK SCREEN */}
      <div className="p-3 sm:p-4 border-t bg-white flex flex-col z-20">
        
        {isFriend ? (
          <>
            {editingMessage && (
              <div className="flex justify-between items-center max-w-4xl mx-auto w-full mb-2 px-1 sm:px-2">
                <span className="text-[12px] sm:text-[13px] font-medium text-[#007AFF] flex items-center gap-1.5">
                  <EditSmallIcon /> Editing Message
                </span>
                <button onClick={() => { setEditingMessage(null); setText(''); }} className="text-[12px] sm:text-[13px] text-gray-400 hover:text-gray-700 transition">Cancel</button>
              </div>
            )}

            {replyingTo && (
              <div className="flex justify-between items-center max-w-4xl mx-auto w-full mb-2 px-3 py-2 bg-gray-100 rounded-lg border-l-4 border-[#007AFF] animate-fade-in">
                <div className="flex flex-col overflow-hidden mr-2">
                  <span className="text-[10px] sm:text-[11px] font-bold text-[#007AFF]">
                    Replying to {replyingTo.sender === myId || replyingTo.senderId === myId ? 'yourself' : contact.username}
                  </span>
                  <span className="text-[12px] sm:text-[13px] text-gray-600 truncate whitespace-nowrap">
                    {replyingTo.type === 'text' ? replyingTo.text : `[${replyingTo.type} attached]`}
                  </span>
                </div>
                <button type="button" onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-gray-700 p-1 flex-shrink-0">
                  <CloseIcon />
                </button>
              </div>
            )}

            <form onSubmit={sendMessage} className="flex gap-2 items-end max-w-4xl mx-auto w-full">
              {!isRecording ? (
                <>
                  {!editingMessage && (
                    <>
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                      <button type="button" onClick={() => fileInputRef.current.click()} className="p-2 sm:p-2.5 text-gray-400 hover:text-[#007AFF] transition hover:bg-blue-50 rounded-full flex-shrink-0">
                        <ClipIcon />
                      </button>
                    </>
                  )}

                  <input
                    className="flex-1 bg-gray-100 text-gray-900 rounded-full px-4 sm:px-5 py-2.5 sm:py-3 text-[14px] sm:text-[15px] outline-none focus:bg-gray-200 transition"
                    value={text}
                    onChange={handleTextChange}
                    placeholder={editingMessage ? "Edit message..." : "iMessage"}
                  />

                  {text.trim() || editingMessage ? (
                    <button
                      type="submit"
                      disabled={uploading}
                      className="w-10 h-10 sm:w-11 sm:h-11 bg-[#007AFF] text-white rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:bg-gray-300 transition"
                    >
                      {uploading ? <span className="animate-pulse text-sm">...</span> : (editingMessage ? <CheckIcon /> : <SendIcon />)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="w-10 h-10 sm:w-11 sm:h-11 bg-gray-100 text-[#007AFF] hover:bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0 transition"
                    >
                      <MicIcon />
                    </button>
                  )}
                </>
              ) : (
                <div className="flex-1 bg-gray-100 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between w-full">
                   <button type="button" onClick={cancelRecording} className="text-red-500 p-1.5 sm:p-2 hover:bg-red-50 rounded-full transition flex items-center gap-1 sm:gap-2 text-[12px] sm:text-sm font-medium">
                     <TrashIcon /> <span className="hidden sm:inline">Cancel</span>
                   </button>
                   
                   <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full animate-pulse" />
                      <span className="font-mono text-[13px] sm:text-sm text-gray-700">{formatSec(recordingTime)}</span>
                   </div>
                   
                   <button type="button" onClick={sendRecording} disabled={recordingTime < 1 || uploading} className="w-8 h-8 sm:w-9 sm:h-9 bg-[#007AFF] text-white rounded-full flex items-center justify-center disabled:opacity-50 transition">
                      {uploading ? <span className="animate-pulse text-xs">...</span> : <SendIcon />}
                   </button>
                </div>
              )}
            </form>
          </>
        ) : (
          // 🔥 THE LOCK: Restricted UI Box
          <div className="flex flex-col items-center justify-center py-4 px-4 bg-gray-50 border border-gray-100 rounded-2xl animate-fade-in text-center mx-auto w-full max-w-2xl">
             <p className="text-[13px] sm:text-[14px] text-gray-500 mb-3">
               You are no longer connected with <span className="font-semibold text-gray-800">{contact.username}</span>. Send a friend request to resume chatting.
             </p>
             <button 
               onClick={handleSendRequest}
               disabled={requestSent}
               className="px-5 py-2.5 bg-[#007AFF] text-white text-[13px] font-bold rounded-full hover:bg-blue-600 transition active:scale-95 shadow-sm disabled:opacity-50 disabled:bg-gray-400 disabled:active:scale-100"
             >
               {requestSent ? 'Request Sent' : 'Add Friend'}
             </button>
          </div>
        )}

      </div>
    </div>
  );
}

// Icons
const DownArrowIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>);
const PhoneIcon = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>);
const VideoIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>);
const MoreIcon = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>);
const SendIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>);
const CheckIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>);
const ClipIcon = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>);
const EditSmallIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>);
const MicIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>);
const TrashIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const CloseIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);