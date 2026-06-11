import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import toast from 'react-hot-toast';

// 🔥 Import the new Crypto Engine
import { generateE2EEKeys, lockVault, unlockVault } from '../utils/crypto';

const TABS = ['login', 'register'];

export default function AuthPage() {
  const [tab, setTab] = useState('login'); // 'login', 'register', or 'forgot'
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 🔥 Verification States
  const [isVerifying, setIsVerifying] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [timer, setTimer] = useState(30);
  const [resendCount, setResendCount] = useState(0); 
  const otpRefs = useRef([]);

  // 🔥 Recovery Phrase Display State
  const [generatedPhrase, setGeneratedPhrase] = useState('');

  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });

  const [regForm, setRegForm] = useState({
    username: '',
    password: '',
    email: '', 
    avatar: null
  });

  // 🔥 Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');

  const [avatarPreview, setAvatarPreview] = useState(null);

  const navigate = useNavigate();
  
  // 🔥 Destructured setPrivateKeys to store the unlocked vault in RAM
  const { login, setUser, setToken, setPrivateKeys } = useAuthStore();

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

  // ⏱️ Timer Logic
  useEffect(() => {
    let interval;
    if (isVerifying && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isVerifying, timer]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(loginForm.username, loginForm.password);

    setLoading(false);

    if (result.success) {
      // 🔥 E2EE LOGIN VAULT UNLOCK
      const userDoc = result.user;
      if (userDoc.primaryVault) {
        const decryptedKeys = await unlockVault(userDoc.primaryVault, loginForm.password);
        if (decryptedKeys) {
          setPrivateKeys(decryptedKeys);
          toast.success('Vault unlocked successfully');
        } else {
          toast.error('Failed to unlock E2EE vault. Recovery needed.');
        }
      }

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

    if (!regForm.username || !regForm.password || !regForm.email) {
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

      // 🔥 1. Generate E2EE Keys
      const keys = generateE2EEKeys();

      // 🔥 2. Lock the Primary Vault with the user's password
      const primaryVault = await lockVault(keys.privateKeys, regForm.password);

      // 🔥 3. Lock the Backup Vault with the generated phrase
      const recoveryVault = await lockVault(keys.privateKeys, keys.recoveryPhrase);

      // Save the phrase to show the user
      setGeneratedPhrase(keys.recoveryPhrase);

      const res = await api.post('/auth/register', {
        username: regForm.username,
        password: regForm.password,
        email: regForm.email, 
        avatar: avatarUrl,
        // 🔥 Send E2EE fields to backend
        publicKey: keys.publicKeys.encPublicKey,
        signPublicKey: keys.publicKeys.signPublicKey,
        primaryVault: primaryVault,
        recoveryVault: recoveryVault
      });

      if (res.data.requiresVerification) {
        setIsVerifying(true);
        setTimer(30);
      } else {
        localStorage.setItem('token', res.data.token);
        setUser(res.data.user);
        setToken(res.data.token);
        navigate('/');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    }

    setLoading(false);
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError('');
    if (value !== '' && index < 5) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      setOtpError("Please fill out all 6 digits.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-email', { 
        email: regForm.email, 
        otp: otpCode 
      });

      // 🔥 Unlock the vault right after verification
      if (res.data.user?.primaryVault) {
        const decryptedKeys = await unlockVault(res.data.user.primaryVault, regForm.password);
        if (decryptedKeys) setPrivateKeys(decryptedKeys);
      }
      
      toast.success('Email verified successfully!');
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      setToken(res.data.token);
      navigate('/');
    } catch (err) {
      setOtpError("OTP didn't match, please check it carefully");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCount >= 3) {
      toast.error("Too many attempts, try again later.");
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', { 
        username: regForm.username, 
        password: regForm.password, 
        email: regForm.email, 
        avatar: null 
      });
      
      toast.success('OTP has been resent!');
      setResendCount(prev => prev + 1);
      setTimer(30);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0].focus();
      setOtpError('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Forgot Password Logic
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return toast.error('Please enter your email');

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail });
      toast.success('Password reset link sent to your email!');
      setTab('login');
      setForgotEmail('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-24 -left-24 w-64 h-64 sm:w-96 sm:h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-purple-400/10 rounded-full blur-3xl"></div>
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
          <p className="text-sm sm:text-base text-gray-500 mt-1 transition-all duration-300">
            Private messaging, beautifully simple
          </p>
        </div>

        <div className="backdrop-blur-xl bg-white/80 border border-white rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 transition-all duration-300">
          
          {isVerifying ? (
            <div className="animate-fade-in flex flex-col items-center">
              
              {/* 🔥 RECOVERY PHRASE WARNING */}
              {generatedPhrase && (
                <div className="w-full bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 shadow-sm">
                  <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    Save Your Recovery Phrase!
                  </h3>
                  <p className="text-[12px] text-orange-700 mb-3 leading-relaxed">
                    Arisun Chat uses End-to-End Encryption. If you forget your password, your chats will be permanently lost unless you have this phrase. Write it down now:
                  </p>
                  <div className="bg-white px-3 py-2 border border-orange-200 rounded-lg text-center font-mono font-bold text-gray-900 tracking-wider text-sm select-all">
                    {generatedPhrase}
                  </div>
                </div>
              )}

              <h2 className="text-2xl font-bold text-gray-900 tracking-tight text-center">Verify Email</h2>
              <p className="text-[14px] text-gray-500 text-center mt-2 mb-6">
                We have sent the OTP to <span className="font-semibold text-gray-900">{regForm.email}</span>
              </p>

              <div className="flex gap-2 sm:gap-3 mb-1 w-full justify-center">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpRefs.current[index] = el)}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className={`w-11 h-14 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      otpError 
                        ? 'border-red-500 text-red-600 bg-red-50' 
                        : 'border-gray-200 text-gray-900 bg-gray-50 focus:bg-white focus:border-blue-500'
                    }`}
                  />
                ))}
              </div>

              <div className="h-6 w-full text-center">
                {otpError && (
                  <p className="text-[12px] font-semibold text-red-500 animate-fade-in">
                    {otpError}
                  </p>
                )}
              </div>

              <div className="w-full flex justify-end mt-2 mb-6 pr-1">
                {timer > 0 ? (
                  <span className="text-[13px] font-medium text-gray-400">
                    Resend in <span className="text-blue-600 font-bold">{timer}s</span>
                  </span>
                ) : (
                  <button 
                    onClick={handleResendOTP}
                    disabled={loading || resendCount >= 3}
                    className={`text-[13px] font-bold transition ${
                      resendCount >= 3 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:opacity-70 active:scale-95'
                    }`}
                  >
                    Resend
                  </button>
                )}
              </div>

              <button 
                onClick={handleVerifyOTP}
                disabled={loading || otp.join('').length < 6}
                className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm sm:text-base hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          ) : (
            <>
              {/* Only show the tabs if we are not in the 'forgot' password view */}
              {tab !== 'forgot' && (
                <div className="flex bg-gray-100 rounded-xl sm:rounded-2xl p-1 mb-6 sm:mb-8 animate-fade-in">
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
              )}

              {tab === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 animate-fade-in">
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Username or Email"
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

                  <div className="flex justify-end mt-[-8px]">
                    <button 
                      type="button"
                      onClick={() => setTab('forgot')}
                      className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Forgot password?
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
                    placeholder="hello@example.com"
                    type="email"
                    required
                    value={regForm.email}
                    onChange={(e) => setRegForm(f => ({ ...f, email: e.target.value }))}
                  />

                  <button
                    disabled={loading}
                    className="w-full py-3 mt-2 rounded-xl bg-blue-600 text-white font-medium text-sm sm:text-base hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100"
                  >
                    {loading ? 'Creating account...' : 'Create Account'}
                  </button>
                </form>
              )}

              {/* 🔥 NEW: Forgot Password View */}
              {tab === 'forgot' && (
                <div className="animate-fade-in flex flex-col items-center">
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight text-center">Reset Password</h2>
                  <p className="text-[14px] text-gray-500 text-center mt-2 mb-6">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>

                  <form onSubmit={handleForgotPassword} className="w-full space-y-4">
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="hello@example.com"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                    />

                    <button
                      disabled={loading}
                      type="submit"
                      className="w-full py-3 mt-2 rounded-xl bg-blue-600 text-white font-medium text-sm sm:text-base hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100"
                    >
                      {loading ? 'Sending Link...' : 'Send Reset Link'}
                    </button>
                  </form>

                  <button 
                    onClick={() => setTab('login')}
                    className="mt-6 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    Back to Login
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}