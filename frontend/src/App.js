import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import ResetPasswordPage from './pages/ResetPasswordPage'; // 🔥 New Import
import { useAuthStore } from './store/authStore';

function ProtectedRoute({ children }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/auth" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { token } = useAuthStore();
  if (token) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { init, initialized } = useAuthStore();
  
  useEffect(() => { init(); }, []);

  if (!initialized) return (
    <div className="min-h-screen bg-surface-0 flex flex-col justify-center items-center gap-4 sm:gap-6 px-4">
      <img 
        src="/Logo.png" 
        className="h-16 sm:h-20 md:h-24 lg:h-28 aspect-square object-contain transition-all duration-300" 
        alt="Arisun Logo" 
      />
      <h1 className="font-bold text-4xl sm:text-[3rem] md:text-6xl lg:text-[4rem] tracking-widest transition-all duration-300">
        Arisun
      </h1>
    </div>
  );

  return (
    <BrowserRouter>
      {/* 🔥 THE FIX: Position updated to top-left to avoid collisions and match your spec */}
      <Toaster position="top-left" toastOptions={{
        style: { background: '#1C1C2E', color: '#e8e8f0', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', fontSize: '14px', fontFamily: "'Plus Jakarta Sans', sans-serif" },
        success: { iconTheme: { primary: '#00E5A0', secondary: '#1C1C2E' } },
        error: { iconTheme: { primary: '#FF4A6B', secondary: '#1C1C2E' } },
      }} />
      <Routes>
        <Route path="/auth" element={<GuestRoute><AuthPage /></GuestRoute>} />
        
        {/* 🔥 NEW: Reset Password Route */}
        <Route path="/reset-password/:token" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
        
        <Route path="/" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}