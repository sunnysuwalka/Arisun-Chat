import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

export const useCallListener = () => {
  // 🔥 Notice we added onlineUsers here for the Radar
  const { callState, setCallState, clearCallState, onlineUsers } = useChatStore();
  const { user } = useAuthStore();
  const socket = getSocket();

  const stateRef = useRef(callState);
  useEffect(() => { stateRef.current = callState; }, [callState]);

  // 📡 THE RADAR: Kills the call instantly if the caller refreshes/closes their tab
  useEffect(() => {
    if (callState && callState.status === 'incoming' && !callState.isGroup && callState.from) {
      if (!onlineUsers.includes(callState.from)) {
        toast.error('Caller disconnected');
        clearCallState();
      }
    }
  }, [onlineUsers, callState, clearCallState]);

  useEffect(() => {
    if (!socket || !user) return;
    const myId = String(user._id || user.id);

    // 📥 1. HANDLE INCOMING
    const handleIncoming = (data) => {
      const { fromUserId, callType, isGroup, groupId, roomName } = data;
      
      if (fromUserId === myId) return;

      const current = stateRef.current;
      if (current && current.status && current.status !== 'idle') {
        socket.emit('call:reject', { toUserId: fromUserId, reason: 'busy', isGroup, groupId });
        return;
      }

      setCallState({ 
        isReceivingCall: true, 
        status: 'incoming', 
        isInitiator: false, 
        from: fromUserId, 
        callType: callType || 'unified',
        isGroup: isGroup || false,
        groupId: groupId || null,
        roomName: roomName || (isGroup ? groupId : [myId, fromUserId].sort().join('_')) 
      });
    };

    // 🤝 2. HANDLE ACCEPTED (The other person answered)
    const handleAccepted = () => {
      setCallState({ status: 'connecting' }); 
    };

    // 🚫 3. HANDLE REJECTED
    const handleRejected = (data) => {
      if (stateRef.current?.isGroup) return; 
      
      toast.error(data?.reason === 'busy' ? 'User is busy' : 'Call declined');
      clearCallState();
    };

    // 🛑 4. HANDLE ENDED
    const handleEnded = () => {
      toast('Call ended');
      clearCallState();
    };

    socket.on('call:incoming', handleIncoming);
    socket.on('call:accepted', handleAccepted);
    socket.on('call:rejected', handleRejected);
    socket.on('call:ended', handleEnded);

    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:accepted', handleAccepted);
      socket.off('call:rejected', handleRejected);
      socket.off('call:ended', handleEnded);
    };
  }, [socket, user, setCallState, clearCallState]);

  // 🚀 5. HANDLE OUTGOING INITIATION
  useEffect(() => {
    const current = callState;
    
    if (current && current.isInitiator && !current.status) {
       setCallState({ status: 'calling' });
       
       socket.emit('call:initiate', {
          toUserId: current.to,
          fromUserId: user._id || user.id,
          callType: current.callType,
          isGroup: current.isGroup,
          groupId: current.groupId
       });
    }
  }, [callState, socket, user, setCallState]);
};