import React from 'react';

export default function Avatar({
  user,
  size = 40,
  online = false,
  className = ''
}) {
  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt={user.username}
          className="w-full h-full rounded-full object-cover border border-slate-200 shadow-sm"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="w-full h-full rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center"
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

      {online && (
        <div
          className="absolute bottom-0 right-0 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
          style={{
            width: size * 0.26,
            height: size * 0.26
          }}
        />
      )}
    </div>
  );
}