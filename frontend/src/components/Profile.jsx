import React, { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { getSocket } from '../utils/socket';

export default function Profile({ onClose }) {
  const { user, setAuthUser } = useAuthStore(); 
  // 🔥 Brought in blockedUsers and loadBlockedUsers from the store
  const { contacts, loadContacts, loadInbox, blockedUsers, loadBlockedUsers } = useChatStore();
  const socket = getSocket();
  
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isEditingGeneral, setIsEditingGeneral] = useState(false);

  const [confirmAction, setConfirmAction] = useState(null);

  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [otp, setOtp] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
    }
  }, [user]);

  // 🔥 Load both connections when the tab opens
  useEffect(() => {
    if (activeTab === 'friends') {
      if (contacts.length === 0) loadContacts();
      loadBlockedUsers();
    }
  }, [activeTab, contacts.length, loadContacts, loadBlockedUsers]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      
      const uploadRes = await api.post('/upload/file', fd);
      const profileRes = await api.put('/users/profile', { avatar: uploadRes.data.url });
      
      if (setAuthUser) setAuthUser(profileRes.data.user || { ...user, avatar: uploadRes.data.url });
      
      toast.success('Profile portrait updated!');
    } catch (err) {
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!username.trim()) return toast.error('Username cannot be empty');

    setLoading(true);
    try {
      if (email === user?.email) {
        const res = await api.put('/users/profile', { username });
        if (setAuthUser && res.data.user) setAuthUser(res.data.user);
        toast.success('Profile updated successfully!');
        setIsEditingGeneral(false);
      } else {
        await api.post('/users/request-email-change', { newEmail: email, username });
        setVerifyingEmail(true);
        toast.success('OTP sent to new email address!');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error('OTP must be 6 digits');

    setLoading(true);
    try {
      const res = await api.post('/users/verify-email-change', { newEmail: email, otp, username });
      if (setAuthUser && res.data.user) setAuthUser(res.data.user);
      toast.success('Email updated successfully!');
      setVerifyingEmail(false);
      setIsEditingGeneral(false);
      setOtp('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setUsername(user?.username || '');
    setEmail(user?.email || '');
    setIsEditingGeneral(false);
    setVerifyingEmail(false);
    setOtp('');
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return toast.error('Please fill out all fields');
    if (newPassword.length < 6) return toast.error('New password must be at least 6 characters');

    setLoading(true);
    try {
      await api.put('/users/password', { currentPassword, newPassword });
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      await api.post('/users/remove', { userId: friendId });
      socket.emit('friend:remove', { userId: friendId }); 
      toast.success('Friend removed');
      loadContacts();
      loadInbox();
    } catch {
      toast.error('Failed to remove friend');
    }
  };

  const handleBlockUser = async (friendId) => {
    try {
      await api.post('/users/block', { userId: friendId });
      socket.emit('friend:remove', { userId: friendId }); 
      toast.success('User blocked');
      loadContacts();
      loadInbox();
      loadBlockedUsers(); // 🔥 Refresh block list instantly
    } catch {
      toast.error('Failed to block user');
    }
  };

  // 🔥 NEW: The Unblock Function
  const handleUnblockUser = async (blockedId) => {
    try {
      await api.post('/users/unblock', { userId: blockedId });
      toast.success('User unblocked');
      loadBlockedUsers(); // 🔥 Refresh instantly
    } catch {
      toast.error('Failed to unblock user');
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    const { action, payload } = confirmAction;
    await action(payload);
    setConfirmAction(null);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#F5F7FB] flex flex-col animate-slide-up sm:animate-fade-in sm:items-center sm:justify-center sm:bg-black/40 sm:p-4">
      
      {/* CUSTOM CONFIRMATION MODAL */}
      {confirmAction && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fade-in">
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

      <div className="flex flex-col h-full w-full sm:max-w-[420px] sm:h-[650px] sm:max-h-[90vh] bg-[#F5F7FB] sm:rounded-[24px] sm:shadow-2xl overflow-hidden relative">
        
        {/* HEADER */}
        <div className="bg-white px-4 sm:px-6 py-4 flex items-center justify-between border-b border-gray-100 z-10 sticky top-0">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Settings</h1>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition active:scale-95"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-8">
          {/* HERO SECTION */}
          <div className="bg-white flex flex-col items-center pt-8 pb-6 border-b border-gray-100">
            <div 
              className="relative group cursor-pointer rounded-full overflow-hidden" 
              onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
            >
              <Avatar user={user} size={84} />
              
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <CameraIcon className="text-white w-8 h-8" />
              </div>

              {uploadingAvatar && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/png, image/jpeg, image/webp" 
              onChange={handleAvatarUpload} 
            />

            <h2 className="mt-3 text-[22px] font-bold text-gray-900">{user?.username}</h2>
            <p className="text-[14px] text-gray-500">{user?.email}</p>
          </div>

          {/* TABS */}
          <div className="flex px-4 mt-6 gap-2">
            {['general', 'security', 'friends'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-[13px] font-semibold rounded-full capitalize transition-all ${
                  activeTab === tab 
                    ? 'bg-[#007AFF] text-white shadow-md' 
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* TAB CONTENT */}
          <div className="px-4 mt-6">
            
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="animate-fade-in">
                {verifyingEmail ? (
                  <form onSubmit={handleVerifyEmailOTP} className="flex flex-col gap-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                    <h3 className="text-sm font-bold text-blue-900 text-center">Verify New Email</h3>
                    <p className="text-[12px] text-gray-500 text-center leading-tight">
                      We sent a 6-digit code to <span className="font-semibold text-gray-900">{email}</span>
                    </p>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      maxLength={6}
                      value={otp} 
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full text-center tracking-[0.5em] font-mono py-3.5 rounded-2xl text-[18px] font-bold bg-white border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all shadow-sm"
                    />
                    <div className="flex gap-2 mt-1">
                      <button 
                        type="button" 
                        onClick={handleCancelEdit}
                        disabled={loading}
                        className="flex-1 py-3 text-sm font-bold text-gray-600 bg-gray-200 rounded-xl hover:bg-gray-300 transition"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={loading || otp.length !== 6}
                        className="flex-[2] bg-[#007AFF] text-white text-sm font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {loading ? 'Verifying...' : 'Confirm'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
                    <div className="flex justify-between items-center mb-[-4px]">
                      <h3 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider ml-1">Personal Info</h3>
                      {!isEditingGeneral && (
                        <button
                          type="button"
                          onClick={() => setIsEditingGeneral(true)}
                          className="text-[13px] text-[#007AFF] font-bold flex items-center gap-1.5 hover:opacity-70 transition-opacity bg-blue-50 px-3 py-1 rounded-full"
                        >
                          <EditSmallIcon /> Edit
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="relative">
                        <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${isEditingGeneral ? 'text-[#007AFF]' : 'text-gray-400'}`}>
                          <UserIcon />
                        </div>
                        <input 
                          type="text" 
                          value={username} 
                          onChange={(e) => setUsername(e.target.value)}
                          readOnly={!isEditingGeneral}
                          placeholder="Username"
                          className={`w-full pl-12 pr-4 py-3.5 rounded-2xl text-[15px] font-medium transition-all outline-none ${
                            isEditingGeneral 
                              ? 'bg-white border border-gray-200 text-gray-900 focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] shadow-sm' 
                              : 'bg-transparent border border-transparent text-gray-700 cursor-default'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="relative">
                        <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${isEditingGeneral ? 'text-[#007AFF]' : 'text-gray-400'}`}>
                          <AtIcon />
                        </div>
                        <input 
                          type="email" 
                          value={email} 
                          onChange={(e) => setEmail(e.target.value)}
                          readOnly={!isEditingGeneral}
                          placeholder={isEditingGeneral ? "Add email address" : "No email added"}
                          className={`w-full pl-12 pr-4 py-3.5 rounded-2xl text-[15px] font-medium transition-all outline-none ${
                            isEditingGeneral 
                              ? 'bg-white border border-gray-200 text-gray-900 focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] shadow-sm' 
                              : 'bg-transparent border border-transparent text-gray-700 cursor-default'
                          }`}
                        />
                      </div>
                    </div>

                    {isEditingGeneral && (
                      <div className="flex gap-3 mt-2 animate-fade-in">
                        <button 
                          type="button" 
                          onClick={handleCancelEdit}
                          disabled={loading}
                          className="flex-1 py-3.5 bg-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-300 transition-all active:scale-[0.98] disabled:opacity-70"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit" 
                          disabled={loading}
                          className="flex-[2] bg-[#007AFF] text-white font-bold py-3.5 rounded-2xl shadow-[0_4px_14px_rgba(0,122,255,0.25)] hover:shadow-[0_6px_20px_rgba(0,122,255,0.3)] transition-all active:scale-[0.98] disabled:opacity-70"
                        >
                          {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    )}
                  </form>
                )}
              </div>
            )}

            {/* SECURITY TAB */}
            {activeTab === 'security' && (
              <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4 animate-fade-in">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider ml-1">Current Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
                      <LockIcon />
                    </div>
                    <input 
                      type="password" 
                      value={currentPassword} 
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider ml-1">New Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
                      <LockIcon />
                    </div>
                    <input 
                      type="password" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all shadow-sm"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="mt-2 w-full bg-gray-900 text-white font-bold py-3.5 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-70"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}

            {/* FRIENDS TAB */}
            {activeTab === 'friends' && (
              <div className="flex flex-col gap-3 animate-fade-in">
                
                {/* ACTIVE CONNECTIONS */}
                {contacts.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-3">Active Friends</h3>
                    <div className="flex flex-col gap-2">
                      {contacts.map(contact => (
                        <div key={contact._id || contact.id} className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <Avatar user={contact} size={42} />
                            <span className="font-semibold text-gray-900 text-[15px]">{contact.username}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => {
                                setConfirmAction({
                                  title: 'Remove Friend?',
                                  description: `Remove ${contact.username} from friends?`,
                                  confirmText: 'Remove',
                                  confirmColor: 'text-[#FF3B30]',
                                  action: () => handleRemoveFriend(contact._id || contact.id),
                                  payload: contact._id || contact.id
                                });
                              }}
                              className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 text-[12px] font-bold rounded-full transition active:scale-95"
                            >
                              Remove
                            </button>
                            <button 
                              onClick={() => {
                                setConfirmAction({
                                  title: 'Block User?',
                                  description: `Block ${contact.username}? They won't be able to message you.`,
                                  confirmText: 'Block',
                                  confirmColor: 'text-[#FF3B30] font-bold',
                                  action: () => handleBlockUser(contact._id || contact.id),
                                  payload: contact._id || contact.id
                                });
                              }}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 text-[12px] font-bold rounded-full transition active:scale-95"
                            >
                              Block
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* BLOCKED USERS */}
                {blockedUsers?.length > 0 && (
                  <div className="mt-2">
                    <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-3">Blocked Users</h3>
                    <div className="flex flex-col gap-2">
                      {blockedUsers.map(blockedUser => (
                        <div key={blockedUser._id || blockedUser.id} className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm opacity-80 hover:opacity-100 transition">
                          <div className="flex items-center gap-3">
                            <div className="grayscale opacity-70">
                              <Avatar user={blockedUser} size={42} />
                            </div>
                            <span className="font-medium text-gray-600 line-through decoration-gray-300 text-[15px]">{blockedUser.username}</span>
                          </div>
                          <button 
                            onClick={() => {
                              setConfirmAction({
                                title: 'Unblock User?',
                                description: `Allow ${blockedUser.username} to send you messages and friend requests?`,
                                confirmText: 'Unblock',
                                confirmColor: 'text-[#007AFF] font-bold',
                                action: () => handleUnblockUser(blockedUser._id || blockedUser.id),
                                payload: blockedUser._id || blockedUser.id
                              });
                            }}
                            className="px-4 py-1.5 bg-blue-50 text-[#007AFF] hover:bg-blue-100 text-[12px] font-bold rounded-full transition active:scale-95"
                          >
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* EMPTY STATE */}
                {contacts.length === 0 && blockedUsers?.length === 0 && (
                  <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <UserIcon className="text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-[14px]">You don't have any friends or blocked users.</p>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// Icons
const CloseIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);
const UserIcon = ({ className }) => (<svg className={className || "w-5 h-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>);
const AtIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path></svg>);
const LockIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>);
const CameraIcon = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>);
const EditSmallIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>);