import React, { useState } from 'react';

export default function Avatar({
  user,
  size = 40,
  online = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);

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
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={user?.username || 'User'}
            draggable="false"
            className="w-full h-full rounded-full object-cover border border-slate-200 shadow-sm pointer-events-none select-none"
            style={{ width: size, height: size }}
          />
        ) : (
          <div
            className="w-full h-full rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center pointer-events-none select-none"
            style={{ width: size, height: size }}
          >
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
              {/* head */}
              <circle cx="12" cy="7" r="3.2" />
              {/* body with bigger gap */}
              <path d="M6 19c0-3.2 2.7-5 6-5s6 1.8 6 5" />
            </svg>
          </div>
        )}

        {/* ONLINE BADGE */}
        {online && (
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
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user?.username || 'User'}
                draggable="false"
                className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full object-cover border-4 border-white/20 select-none"
              />
            ) : (
              <div className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full bg-slate-100 flex items-center justify-center border-4 border-white/20 select-none">
                <svg
                  width="50%"
                  height="50%"
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
              </div>
            )}
            
            {/* Optional username label underneath the picture */}
            {user?.username && (
              <p className="absolute -bottom-10 left-0 right-0 text-center text-white font-medium tracking-wide text-lg drop-shadow-md">
                {user.username}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}