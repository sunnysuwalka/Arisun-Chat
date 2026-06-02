import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import toast from 'react-hot-toast';

const TABS = ['login', 'register'];

export default function AuthPage() {
  const [tab, setTab] = useState('login');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });

  const [regForm, setRegForm] = useState({
    username: '',
    password: '',
    mobile: '',
    avatar: null
  });

  const [avatarPreview, setAvatarPreview] = useState(null);

  const navigate = useNavigate();
  const { login, setUser, setToken } = useAuthStore();

  const passwordStrength = () => {
    const p = regForm.password;
    if (p.length === 0) return 0;
    if (p.length < 6) return 25;
    if (p.length < 8) return 50;
    if (!/[A-Z]/.test(p) || !/\d/.test(p)) return 75;
    return 100;
  };

  const getStrengthColor = (score) => {
    if (score <= 25) return 'bg-red-500';
    if (score <= 50) return 'bg-orange-500';
    if (score <= 75) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(loginForm.username, loginForm.password);

    setLoading(false);

    if (result.success) {
      toast.success('Welcome back');
      navigate('/');
    } else {
      toast.error(result.error);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setRegForm(f => ({ ...f, avatar: file }));

    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!regForm.username || !regForm.password || !regForm.mobile) {
      return toast.error('All fields required');
    }

    setLoading(true);

    try {
      let avatarUrl = null;

      if (regForm.avatar) {
        const fd = new FormData();
        fd.append('avatar', regForm.avatar);
        const uploadRes = await api.post('/upload/avatar', fd);
        avatarUrl = uploadRes.data.url;
      }

      const res = await api.post('/auth/register', {
        username: regForm.username,
        password: regForm.password,
        mobile: regForm.mobile,
        avatar: avatarUrl
      });

      localStorage.setItem('token', res.data.token);

      setUser(res.data.user);
      setToken(res.data.token);

      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      
      {/* Optional: Subtle responsive background blobs for larger screens */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-24 -left-24 w-64 h-64 sm:w-96 sm:h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-purple-400/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md z-10 relative">
        <div className="text-center mb-6 sm:mb-8">
          <img 
  src="/Logo.png" 
  className="h-12 sm:h-16 md:h-20 aspect-square justify-self-center object-contain transition-all duration-300" 
  alt="Arisun Logo" 
/>
<h1 className="font-bold text-blue-900 text-3xl sm:text-4xl md:text-[3rem] tracking-widest text-center transition-all duration-300">
  Arisun
</h1>

          <p className="text-sm sm:text-base text-gray-500 mt-1 transition-all duration-300">
            Private messaging, beautifully simple
          </p>
        </div>

        <div className="backdrop-blur-xl bg-white/80 border border-white rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 transition-all duration-300">
          <div className="flex bg-gray-100 rounded-xl sm:rounded-2xl p-1 mb-6 sm:mb-8">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setStep(1);
                }}
                className={`flex-1 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-medium transition-all duration-200 ${
                  tab === t
                    ? 'bg-white shadow text-blue-600 scale-100'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 animate-fade-in">
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Username"
                value={loginForm.username}
                onChange={(e) => setLoginForm(f => ({ ...f, username: e.target.value }))}
              />

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(f => ({ ...f, password: e.target.value }))}
                />
                <button
                  type="button"
                  className="absolute right-4 top-3.5 text-xs sm:text-sm text-gray-400 hover:text-gray-600 font-medium transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <button
                disabled={loading}
                className="w-full py-3 mt-2 rounded-xl bg-blue-600 text-white font-medium text-sm sm:text-base hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {tab === 'register' && step === 1 && (
            <form onSubmit={handleRegister} className="space-y-4 sm:space-y-5 animate-fade-in">
              <div className="flex justify-center mb-2">
                <label className="cursor-pointer group relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl border-2 border-dashed border-blue-300 bg-blue-50/50 group-hover:bg-blue-50 flex items-center justify-center overflow-hidden transition-colors">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        <span className="text-[10px] sm:text-xs font-medium text-blue-400">Upload</span>
                      </div>
                    )}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>

              <div>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Username"
                  value={regForm.username}
                  onChange={(e) => setRegForm(f => ({ ...f, username: e.target.value }))}
                />
                <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5 ml-1">3–20 characters</p>
              </div>

              <div>
                <input
                  type="password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Password"
                  value={regForm.password}
                  onChange={(e) => setRegForm(f => ({ ...f, password: e.target.value }))}
                />
                
                {/* 🔥 The wired-up password strength indicator */}
                <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ease-out ${getStrengthColor(passwordStrength())}`}
                    style={{ width: `${passwordStrength()}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1.5 ml-1">
                  <p className="text-[10px] sm:text-xs text-gray-400">Use at least 8 characters, 1 uppercase, 1 number</p>
                </div>
              </div>

              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="+91 99999 99999"
                type="tel"
                value={regForm.mobile}
                onChange={(e) => setRegForm(f => ({ ...f, mobile: e.target.value }))}
              />

              <button
                disabled={loading}
                className="w-full py-3 mt-2 rounded-xl bg-blue-600 text-white font-medium text-sm sm:text-base hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}