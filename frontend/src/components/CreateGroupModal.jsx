import React, { useState, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import api from '../utils/api';
import toast from 'react-hot-toast';
import Avatar from './Avatar';

export default function CreateGroupModal({ onClose, onSuccess }) {
  const { contacts } = useChatStore();
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const toggleUser = (user) => {
    const targetId = user._id || user.id;
    if (selectedUsers.includes(targetId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== targetId));
    } else {
      setSelectedUsers([...selectedUsers, targetId]);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload/file', fd);
      setAvatarUrl(res.data.url);
    } catch (err) {
      toast.error('Avatar upload failed');
    }
    setIsUploading(false);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) { toast.error('Provide a group name.'); return; }
    if (selectedUsers.length < 2) { toast.error('Min 3 members required.'); return; }

    try {
      await api.post('/groups', {
        name: groupName.trim(),
        users: JSON.stringify(selectedUsers),
        groupAvatar: avatarUrl // 🔥 SENDING TO BACKEND
      });
      toast.success('Group created!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create group');
    }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#1C1C1E] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white text-xl font-semibold">New Group</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition"><CloseIcon /></button>
        </div>

        {/* 🔥 AVATAR UPLOAD AREA */}
        <div className="flex justify-center mb-6">
          <div 
            onClick={() => fileInputRef.current.click()}
            className="w-24 h-24 rounded-full bg-black/50 border-2 border-white/10 flex items-center justify-center cursor-pointer overflow-hidden relative group hover:border-[#007AFF] transition"
          >
            {isUploading ? <div className="animate-spin w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full" /> : 
             avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : 
             <CameraIcon />}
          </div>
          <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleAvatarUpload} />
        </div>

        <input 
          type="text" 
          placeholder="Group Name" 
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          className="w-full bg-black/50 border border-white/10 text-white rounded-xl px-4 py-3 mb-6 focus:outline-none focus:border-[#007AFF] transition placeholder-gray-500"
        />

        <div className="mb-2 text-[12px] font-bold text-white/50 uppercase tracking-wider px-1">
          Select Members ({selectedUsers.length} selected)
        </div>
        
        <div className="flex-1 overflow-y-auto max-h-[35vh] space-y-1.5 mb-6 pr-2 custom-scrollbar">
          {contacts?.map(contact => {
            const contactId = contact._id || contact.id;
            const isSelected = selectedUsers.includes(contactId);
            return (
              <div key={contactId} onClick={() => toggleUser(contact)} className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition ${isSelected ? 'bg-[#007AFF]/20 border border-[#007AFF]/50' : 'hover:bg-white/5 border border-transparent'}`}>
                <Avatar user={contact} size={40} />
                <span className="text-white font-medium flex-1">{contact.username}</span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-[#007AFF] bg-[#007AFF]' : 'border-white/30'}`}>
                  {isSelected && <CheckIcon />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition active:scale-[0.98]">Cancel</button>
          <button onClick={handleCreateGroup} disabled={selectedUsers.length < 2 || !groupName.trim() || isUploading} className="flex-1 py-3.5 bg-[#007AFF] hover:bg-[#0066CC] disabled:opacity-50 disabled:bg-gray-600 text-white rounded-xl font-semibold transition active:scale-[0.98]">Create</button>
        </div>
      </div>
    </div>
  );
}

const CloseIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);
const CheckIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>);
const CameraIcon = () => (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>);