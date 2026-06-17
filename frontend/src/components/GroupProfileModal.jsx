import React, { useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import Avatar from './Avatar';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function GroupProfileModal({ group, onClose, onGroupUpdate }) {
  const { user } = useAuthStore();
  const { contacts, setActiveContact, sentRequests, addSentRequest } = useChatStore();
  
  const [currentGroup, setCurrentGroup] = useState(group);
  
  const myId = user._id || user.id;
  const adminId = currentGroup.groupAdmin?._id || currentGroup.groupAdmin;
  const isAdmin = adminId === myId;

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(currentGroup.chatName);
  const [uploading, setUploading] = useState(false);
  
  const [showAddMember, setShowAddMember] = useState(false);
  
  const fileInputRef = useRef(null);

  
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    
    try {
      const fd = new FormData();
      fd.append('file', file);
      const uploadRes = await api.post('/upload/file', fd);
      
      // 🔥 Safety Net: Look in the standard URL field, OR inside the raw Cloudinary object
      const actualUrl = uploadRes.data.url || uploadRes.data.rawFile?.secure_url || uploadRes.data.rawFile?.path;
      
      if (!actualUrl) {
        toast.error("Image processed, but URL is hidden. Check console.");
        console.error("RAW SERVER DATA:", uploadRes.data);
        setUploading(false);
        return;
      }

      const res = await api.put('/groups/avatar', {
        chatId: currentGroup._id || currentGroup.id,
        groupAvatar: actualUrl
      });
      
      toast.success('Group avatar updated');
      setCurrentGroup(res.data); 
      if (onGroupUpdate) onGroupUpdate(res.data);
      
    } catch (error) {
      toast.error('Failed to update avatar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveName = async () => {
    if (!editName.trim() || editName === currentGroup.chatName) {
      setIsEditingName(false);
      return;
    }
    try {
      const res = await api.put('/groups/rename', { chatId: currentGroup._id, chatName: editName });
      toast.success('Group name updated');
      setCurrentGroup(res.data); 
      onGroupUpdate(res.data);
      setIsEditingName(false);
    } catch (error) {
      toast.error('Failed to rename group');
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      const res = await api.put('/groups/groupremove', { chatId: currentGroup._id, userId });
      toast.success('Member removed');
      setCurrentGroup(res.data); 
      onGroupUpdate(res.data);
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const handleAddNewMember = async (userId) => {
    try {
      const res = await api.put('/groups/groupadd', { chatId: currentGroup._id, userId });
      toast.success('Member added!');
      setCurrentGroup(res.data); 
      onGroupUpdate(res.data);
      setShowAddMember(false); 
    } catch (error) {
      toast.error('Failed to add member');
    }
  };

  const handleAddFriend = async (userId) => {
    try {
      await api.post('/users/request', { toUserId: userId });
      addSentRequest(userId);
      toast.success('Friend request sent');
    } catch (err) {
      toast.error('Failed to send request');
    }
  };

  const sortedMembers = [...(currentGroup.users || [])].sort((a, b) => {
    const aId = a._id || a.id;
    const bId = b._id || b.id;
    if (aId === myId) return -1;
    if (bId === myId) return 1;
    if (aId === adminId) return -1;
    if (bId === adminId) return 1;
    const nameA = a.username?.toLowerCase() || '';
    const nameB = b.username?.toLowerCase() || '';
    return nameA.localeCompare(nameB);
  });

  const availableContacts = contacts?.filter(contact => {
    return !currentGroup.users.some(u => (u._id || u.id) === (contact._id || contact.id));
  });

  return (
    <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        
        {/* Header & Avatar Section */}
        <div className="bg-gray-50 p-6 flex flex-col items-center relative border-b border-gray-100 transition-all">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5 shadow-sm transition">
            <CloseIcon />
          </button>
          
          <div className={`relative mb-4 ${isAdmin ? 'group cursor-pointer' : ''}`} onClick={() => isAdmin && fileInputRef.current?.click()}>
            <Avatar user={currentGroup} size={90} className="shadow-lg border-4 border-white" />
            {isAdmin && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CameraIcon />}
              </div>
            )}
            {isAdmin && <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />}
          </div>

          {isEditingName && isAdmin ? (
            <div className="flex items-center gap-2 w-full px-4">
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-center font-bold text-lg outline-none focus:border-[#007AFF]" autoFocus />
              <button onClick={handleSaveName} className="bg-[#007AFF] text-white p-2 rounded-xl hover:bg-blue-600 transition"><CheckIcon /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">{currentGroup.chatName}</h2>
              {isAdmin && (
                <button onClick={() => setIsEditingName(true)} className="text-gray-400 hover:text-[#007AFF] transition"><EditIcon /></button>
              )}
            </div>
          )}
          <p className="text-sm text-gray-500 font-medium mt-1">Group • {currentGroup.users?.length || 0} members</p>
        </div>

        {/* Dynamic List Area */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-white relative">
          
          {/* List Header with Add Button Toggle */}
          <div className="flex justify-between items-center px-4 py-2 sticky top-0 bg-white z-10 border-b border-gray-50/50 mb-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {showAddMember ? 'Select Friend to Add' : 'Members'}
            </span>
            
            {isAdmin && (
              <button 
                onClick={() => setShowAddMember(!showAddMember)} 
                className={`text-[13px] font-bold px-3 py-1 rounded-full transition ${showAddMember ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/20'}`}
              >
                {showAddMember ? 'Cancel' : '+ Add'}
              </button>
            )}
          </div>

          {/* VIEW 1: ADD NEW MEMBER */}
          {showAddMember ? (
            <div className="animate-fade-in">
              {availableContacts.length > 0 ? (
                availableContacts.map(contact => (
                  <div key={contact._id || contact.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition cursor-pointer" onClick={() => handleAddNewMember(contact._id || contact.id)}>
                    <div className="flex items-center gap-3">
                      <Avatar user={contact} size={42} />
                      <span className="font-semibold text-gray-900 text-sm">{contact.username}</span>
                    </div>
                    <button className="w-8 h-8 rounded-full bg-[#007AFF] text-white flex items-center justify-center hover:bg-blue-600 shadow-sm transition">
                      <PlusIcon />
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <CheckIcon />
                  </div>
                  <p className="text-sm font-medium text-gray-900">Everyone is here!</p>
                  <p className="text-xs text-gray-500 mt-1">All of your friends are already in this group.</p>
                </div>
              )}
            </div>
          ) : (
            
          /* VIEW 2: STANDARD MEMBERS LIST */
            <div className="animate-fade-in">
              {sortedMembers.map(member => {
                const memberId = member._id || member.id;
                const isMe = memberId === myId;
                const isGroupAdmin = memberId === adminId;
                
                const fullContactInfo = contacts?.find(c => (c._id || c.id) === memberId);
                const isFriend = !!fullContactInfo;
                const hasSent = sentRequests.includes(memberId);

                return (
                  <div key={memberId} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition">
                    <div className="flex items-center gap-3">
                      <Avatar user={member} size={42} />
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900 text-sm">
                          {member.username} {isMe && <span className="text-gray-400 font-normal">(You)</span>}
                        </span>
                        {isGroupAdmin && <span className="text-[10px] text-[#007AFF] font-bold uppercase tracking-wider">Admin</span>}
                      </div>
                    </div>

                    {!isMe && (
                      <div className="flex items-center gap-2">
                        {isAdmin && !isGroupAdmin ? (
                          <button onClick={() => handleRemoveMember(memberId)} className="text-[11px] font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full transition">Remove</button>
                        ) : (
                          !isAdmin && (
                            isFriend ? (
                              <button onClick={() => { onClose(); setActiveContact(fullContactInfo); }} className="text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition">Chat</button>
                            ) : (
                              <button disabled={hasSent} onClick={() => handleAddFriend(memberId)} className={`text-[11px] font-bold px-3 py-1.5 rounded-full transition ${hasSent ? 'bg-gray-100 text-gray-400' : 'bg-[#007AFF] text-white hover:bg-blue-600'}`}>
                                {hasSent ? 'Sent' : 'Add'}
                              </button>
                            )
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CloseIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);
const CameraIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>);
const EditIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>);
const CheckIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>);
const PlusIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);