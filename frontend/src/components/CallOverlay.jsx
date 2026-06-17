import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../utils/socket';
import Avatar from './Avatar';
import toast from 'react-hot-toast';

import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';

const LIVEKIT_URL = "wss://arisun-chat-prm2on5c.livekit.cloud";

const formatSec = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

// ⏱️ TIMER QUARANTINE
const CallTimer = ({ status }) => {
  const [timer, setTimer] = useState(0);
  useEffect(() => {
    let interval;
    if (status === 'connected') interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);
  return <span>{formatSec(timer)}</span>;
};

export default function CallOverlay() {
  // 🔥 1. THE DUPLICATE KILLER (Shatters the Phantom Screen)
  const [isDuplicate, setIsDuplicate] = useState(false);
  
  useEffect(() => {
    window.__ARISUN_OVERLAY_COUNT__ = (window.__ARISUN_OVERLAY_COUNT__ || 0) + 1;
    if (window.__ARISUN_OVERLAY_COUNT__ > 1) {
      setIsDuplicate(true);
      
    }
    return () => {
      window.__ARISUN_OVERLAY_COUNT__ -= 1;
    };
  }, []);

  const { callState, setCallState, clearCallState, generateLiveKitToken, contacts, activeContact } = useChatStore();
  const { user } = useAuthStore();
  const socket = getSocket();

  // 🔥 2. THE STRICT LOCAL TOKEN
  const [localToken, setLocalToken] = useState(null);
  const [tokenError, setTokenError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const tokenFetchRef = useRef(false);

  const status = callState?.status;
  const isInitiator = callState?.isInitiator;
  const isGroup = callState?.isGroup;
  const groupId = callState?.groupId;
  const to = callState?.to;
  const from = callState?.from;
  
  const myId = String(user?._id || user?.id || user?.userId);
  const myName = user?.username || 'Unknown';
  const otherUserId = isInitiator ? to : from;

  const safeRoomName = callState?.roomName || (isGroup ? groupId : [myId, otherUserId].sort().join('_'));

  // Clear local token if the call ends
  useEffect(() => {
    if (!callState || callState.status === 'idle') {
      setLocalToken(null);
    }
  }, [callState]);

  // 🎵 DOM AUDIO CONTROLLER
  useEffect(() => {
    if (isDuplicate) return; // Clones shouldn't control audio
    const outA = document.getElementById('arisun-ring-out');
    const inA = document.getElementById('arisun-ring-in');

    const stopAll = () => {
      if (outA) { outA.pause(); outA.currentTime = 0; }
      if (inA) { inA.pause(); inA.currentTime = 0; }
    };

    if (status === 'calling' && isInitiator && !isGroup) {
      stopAll();
      outA?.play().catch(e => console.log("Audio gracefully blocked:", e));
    } else if (status === 'incoming' && !isInitiator) {
      stopAll();
      inA?.play().catch(e => console.log("Audio gracefully blocked:", e));
    } else {
      stopAll(); 
    }

    return stopAll;
  }, [status, isInitiator, isGroup, isDuplicate]);

  // ⚡ ACTIONS
  const answerCall = () => {
    setCallState({ status: 'connecting' });
    socket.emit('call:accept', { toUserId: from, fromUserId: myId, isGroup, groupId });
  };

  const declineCall = () => {
    socket.emit('call:reject', { toUserId: from, fromUserId: myId, reason: 'declined', isGroup, groupId });
    clearCallState();
  };

  const endCall = useCallback(() => {
    socket.emit('call:end', { toUserId: otherUserId, fromUserId: myId, isGroup, groupId });
    clearCallState();
  }, [socket, otherUserId, myId, isGroup, groupId, clearCallState]);

  // 🎟️ BULLETPROOF TOKEN FETCHER (Immune to Hot-Reloading Desyncs)
  useEffect(() => {
    let isMounted = true;
    
    // If we are connecting/connected but the token vanished (React Hot-Reload Trap), fetch it again!
    const needsToken = (status === 'connecting' || status === 'connected') && !localToken && !tokenFetchRef.current;

    if (needsToken && !isDuplicate) {
       tokenFetchRef.current = true;
       const executeConnection = async () => {
          setTokenError(null);
          try {
             if (!safeRoomName) throw new Error("Room ID missing");
             
             const fetchPromise = generateLiveKitToken(safeRoomName, myName);
             const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Backend API Hung (10s Timeout).")), 10000)
             );

             const jwt = await Promise.race([fetchPromise, timeoutPromise]);
             
             if (!isMounted) return;
             
             if (jwt) {
                setLocalToken(jwt);
                if (status !== 'connected') setCallState({ status: 'connected' });
             } else {
                setTokenError("Backend returned an empty token.");
                setCallState({ status: 'error' }); 
             }
          } catch (err) {
             if (!isMounted) return;
             setTokenError(err.message || "Network Error fetching token.");
             setCallState({ status: 'error' });
          } finally {
             if (isMounted) tokenFetchRef.current = false;
          }
       };
       executeConnection();
    }
    return () => { isMounted = false; };
  }, [status, localToken, safeRoomName, myName, generateLiveKitToken, setCallState, isDuplicate]);


  // 🛑 ABORT RENDERS
  if (isDuplicate) return null; // 🔪 KILLS THE PHANTOM CLONE INSTANTLY
  if (!callState || !status || status === 'idle') return null;

  // 👤 RESOLVE CONTACT INFO 
  let contact = { username: 'Incoming Call...', _id: 'unknown' };
  if (isGroup) {
    contact = activeContact || { username: 'Group Call', _id: groupId || 'group' };
  } else if (otherUserId) {
    const foundInContacts = (contacts || []).find(c => String(c._id || c.id) === String(otherUserId));
    const foundInActive = (activeContact && String(activeContact._id || activeContact.id) === String(otherUserId)) ? activeContact : null;
    contact = foundInContacts || foundInActive || { username: 'Someone', _id: otherUserId };
  }

  const audioNodes = (
    <div style={{ display: 'none' }}>
      <audio id="arisun-ring-out" src="/ringing.mp3" loop preload="auto" />
      <audio id="arisun-ring-in" src="/ringtone.mp3" loop preload="auto" />
    </div>
  );

  // 📺 RENDER 1: ERRORS
  if (status === 'error' || (status === 'connected' && tokenError)) {
    return createPortal(
      <div className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center text-center p-8">
        {audioNodes}
        <div className="text-red-500 mb-4"><PhoneOffIcon /></div>
        <h2 className="text-white text-2xl font-bold mb-2">Connection Failed</h2>
        <p className="text-red-400 font-mono text-sm max-w-md bg-red-500/10 p-4 rounded-xl">{tokenError}</p>
        <button onClick={clearCallState} className="mt-8 px-6 py-3 bg-white text-black font-bold rounded-full">Close</button>
      </div>, document.body
    );
  }

  // 📺 RENDER 2: CONNECTING
  if (status === 'connecting' || (status === 'connected' && !localToken)) {
    return createPortal(
      <div className="fixed inset-0 z-[99999] bg-[#111] flex flex-col items-center justify-center">
        {audioNodes}
        <div className="w-12 h-12 border-4 border-[#007AFF]/30 border-t-[#007AFF] rounded-full animate-spin mb-4" />
        <h2 className="text-white font-medium">Authenticating Secure Connection...</h2>
      </div>, document.body
    );
  }

  // 📺 RENDER 3: COCKPIT
  if (status === 'connected' && localToken) {
    return createPortal(
      <div className={`transition-all duration-300 ${isMinimized ? 'fixed bottom-6 right-6 w-[320px] h-[240px] z-[99999] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-[#111] hover:scale-105 group' : 'fixed inset-0 z-[99999] bg-[#111] animate-fade-in flex flex-col'}`}>
        {audioNodes}
        <div className="absolute top-4 left-4 z-50 flex gap-2">
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition shadow-lg">
            {isMinimized ? <MaximizeIcon /> : <MinimizeIcon />}
          </button>
        </div>
        <div className="absolute top-4 right-4 z-50 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-white font-mono text-sm border border-white/10 shadow-lg">
          <CallTimer status={status} />
        </div>
        <LiveKitRoom
          video={true} 
          audio={true}
          token={localToken}
          serverUrl={LIVEKIT_URL}
          onDisconnected={endCall}
          onError={(error) => {
            console.error("LiveKit Connection Failure:", error);
            toast.error(`Connection failed`);
            clearCallState(); 
          }}
          data-lk-theme="default"
          className="flex-1 flex flex-col w-full h-full relative"
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
        {isMinimized && <div className="absolute inset-0 z-40 cursor-pointer" onClick={() => setIsMinimized(false)} />}
      </div>, document.body
    );
  }

  // 📺 RENDER 4: RINGING UI
  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center animate-fade-in">
      {audioNodes}
      <div className="w-[320px] h-[450px] bg-[#1C1C1E] rounded-[40px] shadow-2xl border border-white/10 flex flex-col items-center justify-between p-8 relative overflow-hidden transition-all duration-300">
        
        <div className="flex flex-col items-center mt-8 z-10 text-center">
          <Avatar user={contact} size={110} className="mb-6 shadow-xl animate-pulse" />
          <h2 className="text-white text-2xl font-semibold tracking-tight">{contact.username}</h2>
          <p className="mt-2 font-medium text-[#007AFF]">
            {status === 'calling' ? 'Calling...' : 'Incoming Call...'}
          </p>
        </div>

        <div className="flex flex-col w-full gap-4 z-10 mb-2">
          {status === 'incoming' && (
            <div className="flex justify-between w-full px-6">
              <button onClick={declineCall} className="w-14 h-14 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"><PhoneOffIcon /></button>
              <button onClick={answerCall} className="w-14 h-14 bg-emerald-500 hover:bg-emerald-400 rounded-full flex items-center justify-center animate-[pulse_1.5s_ease-in-out_infinite] shadow-lg"><PhoneIcon /></button>
            </div>
          )}
          {status === 'calling' && (
            <div className="flex justify-center w-full px-6">
              <button onClick={endCall} className="w-14 h-14 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"><PhoneOffIcon /></button>
            </div>
          )}
        </div>
      </div>
    </div>, document.body
  );
}

// Icons
const PhoneIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>);
const PhoneOffIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-[135deg]"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>);
const CloseIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);
const MinimizeIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>);
const MaximizeIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>);