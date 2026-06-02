import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

const formatSec = (sec) => {
  if (isNaN(sec) || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function MessageBubble({ message, isMine, isLastSeen, onDelete, onEdit, onReact, onReply, repliedToMessage }) {
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatSeenTime = (iso) => {
    if (!iso) return '';
    const diffInMinutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    toast.success('Copied to clipboard');
    setShowMenu(false);
  };

  // 🔥 THE DECODER: Sniff out the secret prefix, strip it, and parse the JSON!
  let isCallLog = message.type === 'call_log';
  let callData = message.callData || {};

  if (!isCallLog && message.type === 'text' && message.text && message.text.startsWith('📞CALL_LOG::')) {
    try {
      const jsonString = message.text.replace('📞CALL_LOG::', '');
      const parsed = JSON.parse(jsonString);
      if (parsed && parsed.status && typeof parsed.duration === 'number') {
        isCallLog = true;
        callData = parsed;
      }
    } catch (e) {
      // Not valid JSON, let it render as normal text
    }
  }

  const renderContent = () => {
    if (isCallLog) {
      const callType = callData.type || 'audio';
      const status = callData.status || 'missed';
      const duration = callData.duration || 0;
      
      const isMissed = status !== 'connected';
      const Icon = callType === 'video' ? VideoIcon : PhoneIcon;
      const title = callType === 'video' ? 'Video call' : 'Voice call';
      
      return (
        <div className="flex flex-col min-w-[160px] sm:min-w-[180px] pt-1 pb-0.5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isMine ? 'bg-white/20' : 'bg-[#007AFF]/10'} flex-shrink-0`}>
               <Icon className={`w-5 h-5 ${isMissed ? 'text-red-500' : (isMine ? 'text-white' : 'text-[#007AFF]')}`} />
            </div>
            <div className="flex flex-col">
              <span className={`font-semibold text-[15px] sm:text-[16px] leading-tight ${isMissed ? 'text-red-500' : (isMine ? 'text-white' : 'text-gray-900')}`}>
                {status === 'missed' || status === 'declined' ? `Missed ${callType} call` : title}
              </span>
              <span className={`text-[12px] sm:text-[13px] mt-0.5 ${isMine ? 'text-white/70' : 'text-gray-500'}`}>
                {status === 'connected' ? formatSec(duration) : 'Missed'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-end mt-1 mb-[-4px]">
            <span className={`text-[10px] whitespace-nowrap tracking-wide ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
              {formatTime(message.createdAt)}
            </span>
          </div>
        </div>
      );
    }

    if (message.type === 'image') {
      return (
        <div className="relative inline-block w-full">
          <img src={message.url} alt="attachment" onClick={() => setIsImageOpen(true)} className={`w-full max-w-[220px] sm:max-w-[300px] rounded-[18px] sm:rounded-[20px] ${isMine ? 'rounded-br-sm' : 'rounded-bl-sm'} cursor-pointer object-cover border border-gray-100 shadow-sm`} />
          <span className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-md text-white/90 text-[10px] px-1.5 py-0.5 rounded-full z-10 pointer-events-none tracking-wide">{formatTime(message.createdAt)}</span>
          {isImageOpen && (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
              <button onClick={() => setIsImageOpen(false)} className="absolute top-6 right-6 text-white text-3xl font-light hover:opacity-75 z-[110]">&times;</button>
              <img src={message.url} className="max-w-full max-h-[90vh] object-contain rounded-lg" alt="fullscreen" />
            </div>
          )}
        </div>
      );
    }

    if (message.type === 'video') {
      return (
        <div className="relative inline-block w-full">
          <div onClick={() => setIsVideoOpen(true)} className={`w-[220px] sm:w-[260px] h-[140px] sm:h-[160px] bg-gray-900 rounded-[18px] sm:rounded-[20px] ${isMine ? 'rounded-br-sm' : 'rounded-bl-sm'} cursor-pointer flex items-center justify-center relative overflow-hidden shadow-sm`}>
             <video src={message.url} className="absolute inset-0 w-full h-full object-cover opacity-60" />
             <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center z-10"><svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>
          </div>
          <span className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-md text-white/90 text-[10px] px-1.5 py-0.5 rounded-full z-10 pointer-events-none tracking-wide">{formatTime(message.createdAt)}</span>
          {isVideoOpen && <CustomVideoPlayer url={message.url} onClose={() => setIsVideoOpen(false)} />}
        </div>
      );
    }

    if (message.type === 'audio') {
      return (
        <div className="flex flex-col w-[200px] sm:w-[240px] pt-1 pb-0.5">
          <CustomAudioPlayer url={message.url} isMine={isMine} />
          <div className="flex items-center justify-end mt-1 mb-[-4px]">
            <span className={`text-[10px] whitespace-nowrap tracking-wide ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>{formatTime(message.createdAt)}</span>
          </div>
        </div>
      );
    }

    if (message.type === 'file') {
      return (
        <div className="flex items-end gap-2 sm:gap-3 flex-wrap">
          <a href={message.url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg"><svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg></div>
            <span className="underline decoration-1 underline-offset-2 text-sm sm:text-base">Download File</span>
          </a>
          <span className={`text-[10px] ml-auto whitespace-nowrap mb-[-2px] tracking-wide ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>{formatTime(message.createdAt)}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1 w-full">
        {repliedToMessage && (
          <div className={`px-2.5 py-1.5 rounded-lg text-[12px] sm:text-[13px] mb-1 opacity-90 border-l-2 ${isMine ? 'bg-white/20 border-white text-white' : 'bg-gray-100 border-[#007AFF] text-gray-600'}`}>
            <div className="font-semibold text-[10px] sm:text-[11px] mb-0.5">
              {isMine && repliedToMessage.sender === message.sender ? 'You replied to yourself' : 'Replied'}
            </div>
            <div className="truncate max-w-[180px] sm:max-w-[200px]">
              {repliedToMessage.type === 'text' ? repliedToMessage.text : `[${repliedToMessage.type}]`}
            </div>
          </div>
        )}
        
        <div className="flex items-end gap-2 sm:gap-3 flex-wrap">
          <p className="break-words whitespace-pre-wrap leading-relaxed text-[14px] sm:text-[15px] max-w-full">
            {message.text}
          </p>
          <div className="flex items-center gap-1 ml-auto mb-[-2px]">
            {message.edited && <span className={`text-[10px] italic ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>(edited)</span>}
            <span className={`text-[10px] whitespace-nowrap tracking-wide ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>{formatTime(message.createdAt)}</span>
          </div>
        </div>
      </div>
    );
  };

  const isMedia = message.type === 'image' || message.type === 'video';
  const hasReactions = message.reactions && message.reactions.length > 0;
  const uniqueEmojis = hasReactions ? Array.from(new Set(message.reactions.map(r => r.emoji))) : [];

  const bubbleStyle = isMedia 
    ? '' 
    : isMine 
      ? 'bg-[#007AFF] text-white rounded-[18px] sm:rounded-[20px] rounded-br-sm shadow-sm px-3.5 sm:px-4 pt-2 pb-1.5 sm:pt-2.5 sm:pb-2' 
      : 'bg-white text-gray-900 border border-gray-100 shadow-sm rounded-[18px] sm:rounded-[20px] rounded-bl-sm px-3.5 sm:px-4 pt-2 pb-1.5 sm:pt-2.5 sm:pb-2';

  const hasActions = message.type === 'text' || message.type === 'audio' || message.type === 'file' || isCallLog || isMine;

  return (
    <div className={`flex ${hasReactions ? 'mb-5' : 'mb-1.5 sm:mb-2'} w-full ${isMine ? 'justify-end' : 'justify-start'} ${showMenu ? 'relative z-50' : ''}`}>
      <div className="max-w-[85%] sm:max-w-[70%] group flex flex-col relative">
        
        <div className={`absolute top-1 sm:top-2 z-20 ${isMine ? '-left-8 sm:-left-10' : '-right-8 sm:-right-10'}`}>
          <button onClick={() => setShowMenu(!showMenu)} className={`p-1 sm:p-1.5 text-gray-400 hover:text-gray-600 bg-white rounded-full shadow-sm border border-gray-200 transition-opacity ${showMenu ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}>
            <DotsIcon />
          </button>

          {showMenu && (
            <div ref={menuRef} className={`absolute z-50 w-[220px] sm:w-[240px] bg-[#f9f9f9]/95 backdrop-blur-xl border border-gray-200/80 shadow-2xl rounded-[20px] sm:rounded-[24px] flex flex-col overflow-hidden animate-fade-in 
              ${isMine ? 'top-8 left-0 sm:left-auto sm:top-0 sm:right-full sm:mr-3' : 'top-8 right-0 sm:right-auto sm:top-0 sm:left-full sm:ml-3'}`}>
              
              <div className="flex justify-between items-center px-3 sm:px-4 py-3 sm:py-3.5 bg-white/50">
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                  <button key={emoji} onClick={() => { onReact(emoji); setShowMenu(false); }} className="hover:scale-125 transition-transform text-[18px] sm:text-[22px] leading-none">
                    {emoji}
                  </button>
                ))}
              </div>

              {hasActions && (
                <div className="flex flex-col bg-white/80">
                  <div className="h-[1px] bg-gray-200/80 w-full" />
                  
                  <button onClick={() => { onReply(); setShowMenu(false); }} className="flex justify-between items-center px-4 sm:px-5 py-3 sm:py-3.5 text-[15px] sm:text-[16px] text-gray-900 hover:bg-gray-100 transition active:bg-gray-200">
                    <span>Reply</span>
                    <ReplyIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {!isCallLog && message.type === 'text' && (
                    <>
                      <div className="h-[1px] bg-gray-200/80 ml-4 sm:ml-5" />
                      <button onClick={handleCopy} className="flex justify-between items-center px-4 sm:px-5 py-3 sm:py-3.5 text-[15px] sm:text-[16px] text-gray-900 hover:bg-gray-100 transition active:bg-gray-200">
                        <span>Copy</span>
                        <CopyIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </>
                  )}
                  
                  {isMine && !isCallLog && message.type === 'text' && (
                    <>
                      <div className="h-[1px] bg-gray-200/80 ml-4 sm:ml-5" />
                      <button onClick={() => { onEdit(message); setShowMenu(false); }} className="flex justify-between items-center px-4 sm:px-5 py-3 sm:py-3.5 text-[15px] sm:text-[16px] text-gray-900 hover:bg-gray-100 transition active:bg-gray-200">
                        <span>Edit</span>
                        <EditPenIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </>
                  )}

                  {isMine && (
                    <>
                      <div className="h-[1px] bg-gray-200/80 ml-4 sm:ml-5" />
                      <button onClick={() => { onDelete(); setShowMenu(false); }} className="flex justify-between items-center px-4 sm:px-5 py-3 sm:py-3.5 text-[15px] sm:text-[16px] text-[#ff3b30] hover:bg-gray-100 transition active:bg-gray-200">
                        <span>Delete</span>
                        <TrashIcon className="text-[#ff3b30] w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* The Bubble */}
        <div className={`relative ${bubbleStyle}`}>
          {renderContent()}

          {/* Render Reactions on the Bubble */}
          {hasReactions && (
            <div className={`absolute -bottom-3 ${isMine ? 'right-2' : 'left-2'} bg-white border border-gray-200 shadow-sm rounded-full px-1.5 py-0.5 text-[10px] sm:text-[12px] flex items-center gap-1 z-10 pointer-events-none`}>
              <span>{uniqueEmojis.join(' ')}</span>
              {message.reactions.length > 1 && <span className="text-[9px] sm:text-[10px] font-medium text-gray-500 ml-0.5">{message.reactions.length}</span>}
            </div>
          )}
        </div>
        
        {/* Seen Indicator */}
        {isMine && isLastSeen && (
          <div className="flex justify-end mt-1 animate-fade-in min-h-[16px]">
            <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#007AFF]">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Seen {formatSeenTime(message.updatedAt)}
            </span>
          </div>
        )}

      </div>
    </div>
  );
}

// Audio Player
function CustomAudioPlayer({ url, isMine }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current.currentTime);
    setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  return (
    <div className={`flex items-center gap-2 sm:gap-3 w-full px-1 ${isMine ? 'text-white' : 'text-[#1c1c1e]'}`}>
      <audio 
        ref={audioRef} 
        src={url} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={(e) => { if (e.target.duration !== Infinity) setDuration(e.target.duration); }}
        onEnded={handleEnded}
      />
      <button onClick={togglePlay} className="flex-shrink-0 focus:outline-none w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center transition-transform active:scale-90">
        {isPlaying ? (
          <svg className="w-4 h-4 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg className="w-5 h-5 sm:w-5 sm:h-5 ml-0.5 sm:ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8V4z" /></svg>
        )}
      </button>
      <div className="flex-1 flex items-center gap-2 sm:gap-3">
        <div 
          className="flex-1 relative flex items-center h-5 cursor-pointer"
          onClick={(e) => {
            if (!duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            audioRef.current.currentTime = clickPos * duration;
          }}
        >
          <div className={`absolute w-full h-[2.5px] sm:h-[3px] rounded-full ${isMine ? 'bg-white/30' : 'bg-gray-300/80'}`} />
          <div className={`absolute h-[2.5px] sm:h-[3px] rounded-full ${isMine ? 'bg-white' : 'bg-[#007AFF]'}`} style={{ width: `${progress}%` }} />
          <div className={`absolute w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full shadow-sm -ml-1.5 ${isMine ? 'bg-white' : 'bg-[#007AFF]'}`} style={{ left: `${progress}%` }} />
        </div>
        <span className={`text-[10px] sm:text-[12px] font-mono font-medium min-w-[30px] sm:min-w-[34px] text-right ${isMine ? 'text-white' : 'text-gray-900'}`}>
          {isPlaying || currentTime > 0 ? formatSec(currentTime) : formatSec(duration)}
        </span>
      </div>
    </div>
  );
}

// Custom Video Player
function CustomVideoPlayer({ url, onClose }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
    setProgress(p);
  };

  const changeSpeed = () => {
    const newSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    videoRef.current.playbackRate = newSpeed;
    setSpeed(newSpeed);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'video.mp4';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-lg flex items-center justify-center p-2 sm:p-4">
      <button onClick={onClose} className="absolute top-4 sm:top-6 right-4 sm:right-6 text-white text-3xl font-light hover:text-gray-300 z-[110]">&times;</button>
      <div className="relative w-full max-w-4xl flex flex-col items-center">
        <video 
          ref={videoRef} src={url} autoPlay 
          className="w-full max-h-[80vh] rounded-lg cursor-pointer object-contain"
          onClick={togglePlay} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={(e) => setDuration(e.target.duration)}
        />
        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 w-[95%] sm:w-[90%] bg-white/10 backdrop-blur-xl border border-white/20 p-2.5 sm:p-4 rounded-[16px] sm:rounded-2xl flex items-center gap-2 sm:gap-4 shadow-2xl">
          <button onClick={togglePlay} className="text-white hover:scale-110 transition p-1">
            {isPlaying ? <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg> : <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
          </button>
          <span className="text-white text-[10px] sm:text-xs font-mono">{formatSec(videoRef.current?.currentTime)}</span>
          <div className="flex-1 h-1.5 sm:h-1.5 bg-white/20 rounded-full overflow-hidden relative cursor-pointer" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const clickPos = (e.clientX - rect.left) / rect.width; videoRef.current.currentTime = clickPos * duration; }}>
             <div className="h-full bg-[#007AFF]" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-white text-[10px] sm:text-xs font-mono">{formatSec(duration)}</span>
          <button onClick={changeSpeed} className="text-white text-[10px] sm:text-xs font-bold bg-white/20 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded">{speed}x</button>
          <button onClick={handleDownload} className="text-white hover:scale-110 transition p-1">
             <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Icons
const DotsIcon = () => (<svg className="w-4 h-4 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>);
const CopyIcon = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>);
const EditPenIcon = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>);
const TrashIcon = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>);
const ReplyIcon = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>);
const PhoneIcon = ({ className }) => (<svg className={className || ""} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>);
const VideoIcon = ({ className }) => (<svg className={className || ""} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>);