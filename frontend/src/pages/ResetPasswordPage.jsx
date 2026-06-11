import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    
    if (password !== confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setLoading(true);
    try {
      await api.put(`/auth/reset-password/${token}`, { password });
      toast.success('Password updated successfully');
      navigate('/auth'); // Redirect to login
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid or expired reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-24 -left-24 w-64 h-64 sm:w-96 sm:h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-emerald-400/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md z-10 relative">
        <div className="text-center mb-6 sm:mb-8">
          <img 
            src="/Logo.png" 
            className="h-12 sm:h-16 md:h-20 aspect-square justify-self-center object-contain transition-all duration-300 mx-auto" 
            alt="Arisun Logo" 
          />
          <h1 className="font-bold text-blue-900 text-3xl sm:text-4xl md:text-[3rem] tracking-widest text-center transition-all duration-300">
            Arisun
          </h1>
        </div>

        <div className="backdrop-blur-xl bg-white/80 border border-white rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 transition-all duration-300">
          
          <div className="animate-fade-in flex flex-col items-center">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight text-center">Create New Password</h2>
            <p className="text-[14px] text-gray-500 text-center mt-2 mb-6">
              Please enter your new password below.
            </p>

            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="New Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-4 top-3.5 text-xs sm:text-sm text-gray-400 hover:text-gray-600 font-medium transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <input
                type={showPassword ? "text" : "password"}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Confirm Password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <button
                disabled={loading}
                type="submit"
                className="w-full py-3 mt-4 rounded-xl bg-blue-600 text-white font-medium text-sm sm:text-base hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>

            <button 
              onClick={() => navigate('/auth')}
              className="mt-6 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
            >
              Cancel & Return to Login
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}