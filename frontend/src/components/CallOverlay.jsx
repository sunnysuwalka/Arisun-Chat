import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../utils/socket';
import Avatar from './Avatar';
import toast from 'react-hot-toast';

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

const formatSec = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function CallOverlay() {
  const { callState, setCallState, contacts, activeContact } = useChatStore();
  const { user } = useAuthStore();
  const socket = getSocket();

  const [callStatus, setCallStatus] = useState('idle'); 
  const [stream, setStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);
  
  const [timer, setTimer] = useState(0);
  
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  // 🔥 NEW: Audio Refs for looping sounds (placed in public folder)
  const ringingAudioRef = useRef(new Audio('/ringing.mp3'));
  const ringtoneAudioRef = useRef(new Audio('/ringtone.mp3'));

  const myId = String(user?._id || user?.id || user?.userId);
  const otherUserId = callState?.isInitiator ? callState?.to : callState?.from;
  
  let contact = { username: 'Someone', _id: 'unknown' };
  if (otherUserId) {
    const foundInContacts = (contacts || []).find(c => String(c._id || c.id) === String(otherUserId));
    const foundInActive = (activeContact && String(activeContact._id || activeContact.id) === String(otherUserId)) ? activeContact : null;
    contact = foundInContacts || foundInActive || { username: 'Someone', _id: otherUserId };
  }
  
  const safeUsername = user?.username || 'You';

  const sendCallLog = useCallback((statusOverride) => {
    if (!callState?.isInitiator || !otherUserId) return;
    
    const status = statusOverride || callStatus;
    const roomId = [myId, otherUserId].sort().join('_');
    
    const callDataPayload = {
      type: callState.callType,
      status: status,
      duration: timer
    };

    socket.emit('message:send', {
      roomId,
      message: { 
        sender: myId, 
        type: 'text', 
        text: `📞CALL_LOG::${JSON.stringify(callDataPayload)}`, 
        createdAt: new Date() 
      }
    });
  }, [callState, callStatus, timer, myId, otherUserId, socket]);

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const newVideoState = !videoTrack.enabled;
        videoTrack.enabled = newVideoState;
        setIsVideoOff(!newVideoState);
        
        socket.emit('call:ice-candidate', { 
          toUserId: otherUserId, 
          candidate: { __isVideoToggle: true, isVideoOff: !newVideoState } 
        });
      }
    }
  };

  const createPeer = useCallback(() => {
    const peer = new RTCPeerConnection(rtcConfig);
    peer.onicecandidate = (event) => {
      if (event.candidate) socket.emit('call:ice-candidate', { toUserId: otherUserId, candidate: event.candidate });
    };
    peer.ontrack = (event) => setRemoteStream(event.streams[0]);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => peer.addTrack(track, streamRef.current));
    return peer;
  }, [otherUserId, socket]);

  const startCall = useCallback(async () => {
    setCallStatus('calling');
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: callState.callType === 'video', audio: true });
      setStream(currentStream);
      streamRef.current = currentStream;

      const peer = createPeer();
      peerRef.current = peer;

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit('call:initiate', { toUserId: callState.to, signalData: offer, fromUserId: myId, callType: callState.callType });
    } catch (err) {
      toast.error("Could not access camera/microphone");
      cleanup();
    }
  }, [callState, createPeer, myId, socket]);

  const answerCall = async () => {
    try {
      let currentStream = streamRef.current;
      if (!currentStream) {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: callState.callType === 'video', audio: true });
        setStream(currentStream);
        streamRef.current = currentStream;
      }
      setCallStatus('connected');
      const peer = createPeer();
      peerRef.current = peer;
      await peer.setRemoteDescription(new RTCSessionDescription(callState.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('call:accept', { toUserId: callState.from, signalData: answer });
      
      setTimeout(() => {
        socket.emit('call:ice-candidate', { toUserId: callState.from, candidate: { __isVideoToggle: true, isVideoOff: isVideoOff } });
      }, 500);
      
    } catch (err) {
      toast.error('Could not access camera/microphone');
      cleanup();
    }
  };

  const declineCall = () => {
    socket.emit('call:reject', { toUserId: callState.from, reason: 'declined' });
    cleanup();
  };

  const endCall = () => {
    if (callState?.isInitiator) sendCallLog(callStatus === 'calling' ? 'missed' : 'connected');
    socket.emit('call:end', { toUserId: otherUserId });
    cleanup();
  };

  const cleanup = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (peerRef.current) peerRef.current.close();
    peerRef.current = null;
    streamRef.current = null;
    setStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setCallState(null);
    setTimer(0);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsRemoteVideoOff(false);
  }, [setCallState]);

  useEffect(() => {
    if (callState?.isInitiator && callStatus === 'idle') startCall();
  }, [callState?.isInitiator, callStatus, startCall]);

  useEffect(() => {
    if (!socket || !myId) return;
    socket.emit('user:online', myId);

    const handleIncoming = async ({ signalData, fromUserId, callType }) => {
      if (callState && callStatus !== 'idle') {
        socket.emit('call:reject', { toUserId: fromUserId, reason: 'busy' });
        return;
      }

      setCallState({ isReceivingCall: true, isInitiator: false, from: fromUserId, offer: signalData, callType });
      setCallStatus('incoming');
      
      if (callType === 'video') {
        try {
          const prepStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setStream(prepStream);
          streamRef.current = prepStream;
        } catch (e) {}
      }
    };

    const handleAccepted = async (signalData) => {
      setCallStatus('connected');
      if (peerRef.current) await peerRef.current.setRemoteDescription(new RTCSessionDescription(signalData));
      
      setTimeout(() => {
        socket.emit('call:ice-candidate', { toUserId: otherUserId, candidate: { __isVideoToggle: true, isVideoOff: isVideoOff } });
      }, 500);
    };

    const handleIceCandidate = async (candidate) => {
      if (candidate && candidate.__isVideoToggle !== undefined) {
        setIsRemoteVideoOff(candidate.isVideoOff);
        return; 
      }

      if (peerRef.current && candidate) {
        try { await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
      }
    };

    const handleRejected = (data) => { 
      if (callState?.isInitiator) {
        const finalStatus = data?.reason === 'busy' ? 'busy' : 'declined';
        setCallStatus(finalStatus);
        sendCallLog(finalStatus); 
        if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      } else {
        cleanup();
      }
    };

    const handleEnded = () => { 
      if (callStatus === 'connected') toast('Call ended'); 
      if (callState?.isInitiator) sendCallLog('connected'); 
      cleanup(); 
    };

    socket.on('call:incoming', handleIncoming);
    socket.on('call:accepted', handleAccepted);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:ended', handleEnded);
    socket.on('call:rejected', handleRejected);

    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:accepted', handleAccepted);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:ended', handleEnded);
      socket.off('call:rejected', handleRejected);
    };
  }, [socket, myId, callState, callStatus, sendCallLog, cleanup, isVideoOff, otherUserId]);

  useEffect(() => {
    let interval;
    if (callStatus === 'connected') interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  useEffect(() => {
    let ringTimeout;
    
    if (callStatus === 'calling' || callStatus === 'incoming') {
      ringTimeout = setTimeout(() => {
        toast('Call missed (No answer)');
        if (callState?.isInitiator) {
          sendCallLog('missed');
          socket.emit('call:end', { toUserId: otherUserId });
        }
        cleanup();
      }, 31000); 
    }

    return () => clearTimeout(ringTimeout);
  }, [callStatus, callState?.isInitiator, sendCallLog, cleanup, socket, otherUserId]);

  // 🔥 NEW PROTOCOL: Audio playback manager
  useEffect(() => {
    const ringingAudio = ringingAudioRef.current;
    const ringtoneAudio = ringtoneAudioRef.current;

    // Ensure they loop indefinitely
    ringingAudio.loop = true;
    ringtoneAudio.loop = true;

    // Helper to stop all sounds
    const stopAllAudio = () => {
      ringingAudio.pause();
      ringingAudio.currentTime = 0;
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
    };

    if (callStatus === 'calling' && callState?.isInitiator) {
      // The caller hears the ringing sound
      stopAllAudio(); // Ensure ringtone isn't somehow playing
      ringingAudio.play().catch(e => console.log("Audio play blocked by browser:", e));
    } else if (callStatus === 'incoming' && !callState?.isInitiator) {
      // The receiver hears the incoming ringtone
      stopAllAudio(); // Ensure ringing isn't somehow playing
      ringtoneAudio.play().catch(e => console.log("Audio play blocked by browser:", e));
    } else {
      // If idle, connected, declined, or missed -> silence the sounds
      stopAllAudio();
    }

    // Cleanup function: stop audio if the component unmounts suddenly
    return () => stopAllAudio();
  }, [callStatus, callState?.isInitiator]);

  if (!callState || callStatus === 'idle') return null;

  const renderAudioUI = () => (
    <div className="w-[320px] h-[500px] bg-[#1C1C1E] rounded-[40px] shadow-2xl border border-white/10 flex flex-col items-center justify-between p-8 relative overflow-hidden transition-all duration-300">
      
      {remoteStream && callStatus === 'connected' && (
        <audio ref={el => { if(el) el.srcObject = remoteStream }} autoPlay playsInline />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-[#007AFF]/10 to-transparent pointer-events-none" />
      
      <div className="flex flex-col items-center mt-8 z-10 text-center">
        <Avatar user={contact} size={100} className="mb-6 shadow-xl" />
        <h2 className="text-white text-2xl font-semibold tracking-tight">{contact.username}</h2>
        <p className="text-white/60 mt-2 font-medium">
          {callStatus === 'calling' && 'Calling...'}
          {callStatus === 'incoming' && 'Incoming call'}
          {callStatus === 'connected' && formatSec(timer)}
          {callStatus === 'declined' && <span className="text-red-400">Call Declined</span>}
          {callStatus === 'busy' && <span className="text-orange-400">In another call</span>}
        </p>
      </div>

      <div className="flex flex-col w-full gap-4 z-10 mb-4">
        {callStatus === 'incoming' && (
          <div className="flex justify-between w-full px-4">
            <button onClick={declineCall} className="w-16 h-16 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-red-500/30">
              <PhoneOffIcon />
            </button>
            <button onClick={answerCall} className="w-16 h-16 bg-emerald-500 hover:bg-emerald-400 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-emerald-500/30" style={{animationDelay: '100ms'}}>
              <PhoneIcon />
            </button>
          </div>
        )}

        {(callStatus === 'declined' || callStatus === 'busy') && (
          <div className="flex justify-between w-full px-4">
            <button onClick={cleanup} className="w-16 h-16 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-md transition">
              <CloseIcon />
            </button>
            <button onClick={startCall} className="w-16 h-16 bg-emerald-500 hover:bg-emerald-400 rounded-full flex items-center justify-center shadow-lg transition">
              <PhoneIcon />
            </button>
          </div>
        )}

        {(callStatus === 'calling' || callStatus === 'connected') && (
          <div className="flex justify-between w-full px-4">
            <button onClick={toggleMute} className={`w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-md transition ${isMuted ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}>
              {isMuted ? <MicOffIcon /> : <MicIcon />}
            </button>
            <button onClick={endCall} className="w-16 h-16 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
              <PhoneOffIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderVideoUI = () => (
    <div className="w-[95vw] h-[90vh] max-w-6xl flex flex-col items-center justify-center relative gap-6 transition-all duration-300">
      
      <div className={`w-full max-w-5xl flex-1 rounded-[32px] overflow-hidden relative ${callStatus === 'connected' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'flex items-center justify-center'}`}>
        
        {callStatus === 'connected' && (
          <div className="relative w-full h-full aspect-[4/3] bg-[#1C1C1E] rounded-[24px] overflow-hidden flex items-center justify-center shadow-2xl border border-white/10">
            {remoteStream ? (
              isRemoteVideoOff ? (
                <div className="flex flex-col items-center text-center p-4">
                  <Avatar user={contact} size={100} className="mb-4 shadow-xl" />
                  <h3 className="text-white text-xl font-medium">{contact.username}</h3>
                  <p className="text-white/50 mt-1">Camera is off</p>
                </div>
              ) : (
                <video ref={el => { if(el) el.srcObject = remoteStream }} autoPlay playsInline className="w-full h-full object-cover" />
              )
            ) : (
              <div className="flex flex-col items-center">
                <Avatar user={contact} size={80} className="mb-4 opacity-50" />
                <span className="text-white/50">Connecting video...</span>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 z-10">
              <Avatar user={contact} size={24} />
              <span className="text-white text-sm font-medium">{contact.username}</span>
            </div>
          </div>
        )}

        {(callStatus !== 'declined' && callStatus !== 'busy') && (
          <div className={`relative w-full aspect-[4/3] bg-[#1C1C1E] flex items-center justify-center shadow-2xl border border-white/10 ${callStatus === 'connected' ? 'rounded-[24px] h-full' : 'max-w-3xl rounded-[32px]'}`}>
            {isVideoOff ? (
              <div className="flex flex-col items-center text-center">
                <Avatar user={user} size={100} className="mb-4 shadow-xl" />
                <h3 className="text-white text-xl font-medium">{safeUsername} (You)</h3>
                <p className="text-white/50 mt-1">Camera is off</p>
                {callStatus === 'calling' && <p className="text-white mt-4 font-semibold animate-pulse">Calling {contact.username}...</p>}
                {callStatus === 'incoming' && <p className="text-white mt-4 text-lg font-semibold animate-pulse">{contact.username} is calling you...</p>}
              </div>
            ) : (
              <>
                <video ref={el => { if(el) el.srcObject = stream }} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 z-10">
                  <Avatar user={user} size={24} />
                  <span className="text-white text-sm font-medium">{safeUsername} (You)</span>
                </div>
                {callStatus === 'calling' && (
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full text-white font-medium animate-[pulse_2s_ease-in-out_infinite] whitespace-nowrap z-20">
                    Calling {contact.username}...
                  </div>
                )}
                {callStatus === 'incoming' && (
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-[#007AFF]/90 backdrop-blur-xl px-6 py-3 rounded-full text-white font-bold shadow-2xl border border-white/20 animate-[pulse_1.5s_ease-in-out_infinite] whitespace-nowrap z-20">
                    {contact.username} is calling you...
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {(callStatus === 'declined' || callStatus === 'busy') && (
          <div className="w-full max-w-3xl aspect-[4/3] bg-[#1C1C1E] rounded-[32px] border border-white/10 flex flex-col items-center justify-center text-center shadow-2xl">
            <Avatar user={contact} size={120} className="mb-6 opacity-50 grayscale" />
            <h2 className="text-white text-3xl font-semibold mb-2">{contact.username}</h2>
            <p className={callStatus === 'busy' ? "text-orange-400 text-lg font-medium" : "text-red-400 text-lg font-medium"}>
              {callStatus === 'busy' ? 'In another call' : 'Call Declined'}
            </p>
          </div>
        )}
      </div>

      <div className="bg-[#1C1C1E]/90 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-full shadow-2xl flex items-center gap-6">
        <div className="w-24 text-center font-mono font-medium text-white/80 border-r border-white/10 pr-6 mr-2">
          {callStatus === 'connected' ? formatSec(timer) : (callStatus === 'declined' || callStatus === 'busy' ? 'Ended' : 'Wait...')}
        </div>

        {callStatus === 'incoming' ? (
           <>
             <button onClick={toggleVideo} className={`w-14 h-14 rounded-full flex items-center justify-center transition hover:scale-110 ${isVideoOff ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                {isVideoOff ? <VideoOffIcon /> : <VideoIcon />}
             </button>
             <button onClick={declineCall} className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform ml-4">
               <PhoneOffIcon />
             </button>
             <button onClick={answerCall} className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform animate-[pulse_1.5s_ease-in-out_infinite]">
               <VideoIcon />
             </button>
           </>
        ) : (callStatus === 'declined' || callStatus === 'busy') ? (
           <>
             <button onClick={cleanup} className="w-14 h-14 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition">
               <CloseIcon />
             </button>
             <button onClick={startCall} className="px-6 h-14 bg-emerald-500 hover:bg-emerald-400 rounded-full flex items-center justify-center text-white font-medium shadow-lg hover:scale-105 transition-transform">
               Call Again
             </button>
           </>
        ) : (
           <>
             <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition hover:scale-110 ${isMuted ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                {isMuted ? <MicOffIcon /> : <MicIcon />}
             </button>
             <button onClick={toggleVideo} className={`w-14 h-14 rounded-full flex items-center justify-center transition hover:scale-110 ${isVideoOff ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                {isVideoOff ? <VideoOffIcon /> : <VideoIcon />}
             </button>
             <button onClick={endCall} className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform ml-4">
               <PhoneOffIcon />
             </button>
           </>
        )}
      </div>
    </div>
  );

  const overlayContent = (
    <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center">
      {callState.callType === 'audio' ? renderAudioUI() : renderVideoUI()}
    </div>
  );

  return createPortal(overlayContent, document.body);
}

// --- ICONS ---
const PhoneIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>);
const PhoneOffIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-[135deg]"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>);
const MicIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>);
const MicOffIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>);
const VideoIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>);
const VideoOffIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>);
const CloseIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);