import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { groupNotificationsByDate } from '../utils/dateHelpers';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../utils/socket';
import Avatar from './Avatar';
import toast from 'react-hot-toast';

export default function NotificationPanel({ onClose, onSelectContact }) {
  const [notifications, setNotifications] = useState([]);
  const { acceptRequest, declineRequest } = useChatStore();
  const { user } = useAuthStore();
  const socket = getSocket();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to load notifications");
    }
  };

  const markAsRead = async (notifId) => {
    setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, isRead: true } : n));
    await api.put(`/notifications/${notifId}/read`);
  };

  const handleAction = async (notif, status) => {
    try {
      const senderId = notif.sender._id || notif.sender; // Extract ID safely

      setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, status, isRead: true } : n));
      await api.put(`/notifications/${notif._id}/action`, { status });
      
      if (status === 'accepted') {
        await acceptRequest(senderId); 
        socket.emit('request:accept', { toUserId: senderId, fromUserId: user?.id || user?._id });
        toast.success("Request accepted!");
      } else {
        await declineRequest(senderId);
        socket.emit('request:decline', { toUserId: senderId, fromUserId: user?.id || user?._id });
      }
    } catch (err) {
      toast.error("Action failed");
      fetchNotifications(); 
    }
  };

  const handleChatClick = (senderId, senderUsername, senderAvatar) => {
    onSelectContact({ _id: senderId, username: senderUsername, avatar: senderAvatar });
    onClose();
  };

  const grouped = groupNotificationsByDate(notifications);

  const renderGroup = (title, items) => {
    if (items.length === 0) return null;
    
    return (
      <div className="mb-2">
        <h3 className="text-[11px] font-medium text-gray-400 tracking-wide mb-1.5 px-1 mt-4 first:mt-1">
          {title}
        </h3>
        <div className="space-y-1.5">
          {items.map(notif => (
            <div 
              key={notif._id}
              onMouseEnter={() => !notif.isRead && markAsRead(notif._id)}
              className={`p-2.5 rounded-2xl transition-all ${
                notif.isRead ? 'bg-white' : 'bg-blue-50/40'
              } border border-gray-100 shadow-sm flex items-center justify-between`}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                <Avatar 
                  user={notif.sender || { username: notif.senderUsername, avatar: notif.senderAvatar }} 
                  size={38} 
                />
                <span className={`text-[14px] truncate ${notif.isRead ? 'text-gray-700 font-medium' : 'text-gray-900 font-semibold'}`}>
                  {notif.sender?.username || notif.senderUsername}
                </span>
              </div>
              
              <div className="flex items-center gap-1.5 shrink-0">
                {notif.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => handleAction(notif, 'accepted')} 
                      className="px-3 py-1.5 bg-[#007AFF] text-white text-[12px] font-bold rounded-full hover:bg-blue-600 transition active:scale-95"
                    >
                      Accept
                    </button>
                    <button 
                      onClick={() => handleAction(notif, 'declined')} 
                      className="px-3 py-1.5 bg-[#E8EAED] text-[#3C4043] text-[12px] font-bold rounded-full hover:bg-gray-300 transition active:scale-95"
                    >
                      Decline
                    </button>
                  </>
                )}
                
                {notif.status === 'accepted' && (
                  <button 
                    onClick={() => handleChatClick(notif.sender?._id || notif.sender, notif.sender?.username || notif.senderUsername, notif.sender?.avatar || notif.senderAvatar)} 
                    className="px-5 py-1.5 bg-emerald-100 text-emerald-700 text-[12px] font-bold rounded-full hover:bg-emerald-200 transition active:scale-95"
                  >
                    Chat
                  </button>
                )}

                {notif.status === 'declined' && (
                  <span className="text-[11px] font-medium text-gray-400 px-2 py-1.5">
                    Declined
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-[190] bg-black/5 sm:bg-transparent sm:block hidden" 
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[200] bg-[#F5F7FB] flex flex-col animate-slide-up sm:animate-fade-in sm:absolute sm:inset-auto sm:top-[65px] sm:left-3 sm:right-3 sm:bottom-auto sm:w-auto sm:max-h-[450px] sm:rounded-[20px] sm:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] sm:border sm:border-gray-200 overflow-hidden">
        
        <div className="sm:hidden bg-white px-4 py-4 flex items-center justify-between border-b border-gray-100 shrink-0">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Notifications</h1>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition active:scale-95"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-3 custom-scrollbar bg-[#F5F7FB] sm:bg-white/90 sm:backdrop-blur-xl">
          {renderGroup('Today', grouped.today)}
          {renderGroup('Yesterday', grouped.yesterday)}
          {renderGroup('Last Week', grouped.lastWeek)}
          {renderGroup('Older', grouped.older)}
          
          {notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                <BellIcon />
              </div>
              <p className="text-[14px] font-medium text-gray-500">No notifications yet</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const CloseIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);
const BellIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>);