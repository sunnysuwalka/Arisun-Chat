import React, { useState } from 'react';

export default function Avatar({
  user,
  size = 40,
  online = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Determine if this is a group or a single user
  const isGroup = user?.isGroupChat || user?.isGroup;
  const avatarUrl = isGroup ? user?.groupAvatar : user?.avatar;
  const name = isGroup ? (user?.chatName || 'Group') : (user?.username || 'User');

  return (
    <>
      {/* THE STANDARD AVATAR BUTTON */}
      <div
        className={`relative flex-shrink-0 cursor-pointer transition-transform hover:opacity-90 active:scale-95 ${className}`}
        style={{ width: size, height: size }}
        onClick={(e) => {
          e.stopPropagation(); // Prevents clicking the avatar from accidentally opening a chat room
          setIsOpen(true);
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            draggable="false"
            className="w-full h-full rounded-full object-cover border border-slate-200 shadow-sm pointer-events-none select-none"
            style={{ width: size, height: size }}
          />
        ) : (
          <div
            className="w-full h-full rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center pointer-events-none select-none"
            style={{ width: size, height: size }}
          >
            {isGroup ? (
              // 🔥 NEW: Group Fallback SVG matching your theme
              <svg
                width={size * 0.64}
                height={size * 0.64}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#111111"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            ) : (
              // ORIGINAL: Single User Fallback SVG
              <svg
                width={size * 0.64}
                height={size * 0.64}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#111111"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="7" r="3.2" />
                <path d="M6 19c0-3.2 2.7-5 6-5s6 1.8 6 5" />
              </svg>
            )}
          </div>
        )}

        {/* ONLINE BADGE (Only for individual users, not groups) */}
        {!isGroup && online && (
          <div
            className="absolute bottom-0 right-0 rounded-full bg-emerald-500 border-2 border-white shadow-sm pointer-events-none"
            style={{
              width: size * 0.26,
              height: size * 0.26
            }}
          />
        )}
      </div>

      {/* THE LIGHTBOX MODAL */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-fade-in cursor-default"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        >
          <div className="relative scale-in-center shadow-2xl rounded-full">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                draggable="false"
                className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full object-cover border-4 border-white/20 select-none"
              />
            ) : (
              <div className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full bg-slate-100 flex items-center justify-center border-4 border-white/20 select-none">
                {isGroup ? (
                  <svg width="50%" height="50%" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ) : (
                  <svg width="50%" height="50%" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="7" r="3.2" />
                    <path d="M6 19c0-3.2 2.7-5 6-5s6 1.8 6 5" />
                  </svg>
                )}
              </div>
            )}
            
            {/* Label underneath the picture */}
            {name && (
              <p className="absolute -bottom-10 left-0 right-0 text-center text-white font-medium tracking-wide text-lg drop-shadow-md">
                {name}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}