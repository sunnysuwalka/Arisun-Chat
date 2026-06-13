import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import toast from 'react-hot-toast';

// 🔥 Import the Crypto Engine
import { generateE2EEKeys, lockVault, unlockVault } from '../utils/crypto';

const TABS = ['login', 'register'];

export default function AuthPage() {
  const [tab, setTab] = useState('login'); 
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Verification States
  const [isVerifying, setIsVerifying] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [timer, setTimer] = useState(30);
  const [resendCount, setResendCount] = useState(0); 
  const otpRefs = useRef([]);

  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });

  const [regForm, setRegForm] = useState({
    username: '',
    password: '',
    email: '', 
    pin: '', 
    avatar: null
  });

  // Real-time Inline Error States
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  // 🔥 NEW: Forgot Password States
  const [forgotUsername, setForgotUsername] = useState('');
  const [isResetSent, setIsResetSent] = useState(false);
  const [resetEmailTarget, setResetEmailTarget] = useState('your registered email');

  const [avatarPreview, setAvatarPreview] = useState(null);

  const navigate = useNavigate();
  const { login, setUser, setToken, setPrivateKeys } = useAuthStore();

  // 🔥 1. REAL-TIME USERNAME CHECK
  useEffect(() => {
    const u = regForm.username.trim();
    if (u.length === 0) {
      setUsernameError('');
      return;
    }
    if (u.length < 3 || u.length > 20 || !/^[a-zA-Z0-9_]+$/.test(u)) {
      setUsernameError('3-20 characters, alphanumeric & underscores only');
      return;
    }

    setUsernameError(''); 
    setIsCheckingUsername(true);

    const checkDb = setTimeout(async () => {
      if (tab !== 'register') return;
      try {
        const res = await api.post('/auth/check-availability', { username: u });
        if (res.data.usernameTaken) {
          setUsernameError('Username already exists');
        }
      } catch (err) {
        console.error('Failed to verify username', err);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500); 

    return () => clearTimeout(checkDb);
  }, [regForm.username, tab]);

  // 🔥 2. REAL-TIME STRICT EMAIL CHECK
  useEffect(() => {
    const e = regForm.email.trim();
    if (e.length === 0) {
      setEmailError('');
      return;
    }
    
    // Bulletproof regex: Stops "www.@mail.com" or ".@mail.com"
    const emailRegex = /^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(e)) {
      setEmailError('Invalid email format');
      return;
    }

    setEmailError('');

    const checkDb = setTimeout(async () => {
      if (tab !== 'register') return;
      try {
        const res = await api.post('/auth/check-availability', { email: e });
        if (res.data.emailTaken) {
          setEmailError('Email already registered');
        }
      } catch (err) {
        console.error('Failed to verify email', err);
      }
    }, 500);

    return () => clearTimeout(checkDb);
  }, [regForm.email, tab]);

  // 🔥 3. REAL-TIME PASSWORD CHECK
  useEffect(() => {
    const p = regForm.password;
    if (p.length === 0) {
      setPasswordError('');
      return;
    }
    
    let errs = [];
    if (p.length < 6) errs.push('6+ chars');
    if (!/[a-zA-Z]/.test(p)) errs.push('1 letter');
    if (!/\d/.test(p)) errs.push('1 number');

    if (errs.length > 0) {
      setPasswordError(`Requires: ${errs.join(', ')}`);
    } else {
      setPasswordError('');
    }
  }, [regForm.password]);

  const passwordStrength = () => {
    const p = regForm.password;
    if (p.length === 0) return 0;
    if (p.length < 6) return 25;
    if (p.length < 8) return 50;
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 75;
    return 100;
  };

  const getStrengthColor = (score) => {
    if (score <= 25) return 'bg-red-500';
    if (score <= 50) return 'bg-orange-500';
    if (score <= 75) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  // Timer Logic
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
      // 🔥 THE RESCUE ROUTER: Slide into the OTP screen if unverified
      if (result.requiresVerification) {
        toast.success(result.message || "Welcome back! Let's verify your email.");
        // Silently populate the register form so the OTP APIs and E2EE Vault unlock have all required data
        setRegForm(f => ({ 
          ...f, 
          username: loginForm.username, 
          email: result.email, 
          password: loginForm.password 
        }));
        setIsVerifying(true);
        setTimer(30);
        return;
      }

      const userDoc = result.user;
      if (userDoc.primaryVault) {
        const decryptedKeys = await unlockVault(userDoc.primaryVault, loginForm.password);
        if (decryptedKeys) {
          setPrivateKeys(decryptedKeys);
        } else {
          toast.error('Failed to unlock E2EE vault. Recovery needed.');
        }
      }
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

    // Final Gatekeeper: Do not submit if any inline errors exist
    if (usernameError || emailError || passwordError) {
      return toast.error('Please fix the errors in the form before submitting');
    }

    if (!regForm.username || !regForm.password || !regForm.email || !regForm.pin) {
      return toast.error('All fields are required');
    }

    if (regForm.pin.length !== 6) {
      return toast.error('Backup PIN must be exactly 6 digits');
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

      const keys = await generateE2EEKeys();
      const primaryVault = await lockVault(keys.privateKeys, regForm.password);
      const pinEscrow = await lockVault(keys.privateKeys, regForm.pin);

      const res = await api.post('/auth/register', {
        username: regForm.username,
        password: regForm.password,
        email: regForm.email, 
        avatar: avatarUrl,
        publicKey: keys.publicKeys.encPublicKey,
        signPublicKey: keys.publicKeys.signPublicKey,
        primaryVault: primaryVault.encryptedData || primaryVault, 
        encryptedMasterKey: pinEscrow.encryptedData || pinEscrow, 
        pinSalt: pinEscrow.salt || 'embedded' 
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

      if (res.data.user?.primaryVault) {
        const decryptedKeys = await unlockVault(res.data.user.primaryVault, regForm.password);
        if (decryptedKeys) setPrivateKeys(decryptedKeys);
      }
      
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

  // 🔥 Handles the new Username-based flow
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotUsername.trim()) return toast.error('Please enter your username');

    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { username: forgotUsername.trim() });
      
      // If backend passes back a masked email string (e.g. "j***@gmail.com"), use it. Otherwise use a fallback.
      if (res.data.email) {
        setResetEmailTarget(res.data.email);
      }
      
      setIsResetSent(true);
      toast.success('Reset link sent!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = !usernameError && !emailError && !passwordError && 
                      regForm.username && regForm.email && regForm.password && regForm.pin.length === 6;

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
                    <div className="relative">
                      <input
                        className={`w-full border rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 transition-all ${usernameError ? 'border-red-400 focus:ring-red-500/20 bg-red-50' : 'border-gray-200 focus:ring-blue-500 focus:bg-white bg-gray-50'}`}
                        placeholder="Username"
                        value={regForm.username}
                        onChange={(e) => setRegForm(f => ({ ...f, username: e.target.value }))}
                      />
                      {isCheckingUsername && (
                        <div className="absolute right-4 top-4 w-4 h-4 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    {usernameError ? (
                      <p className="text-[11px] font-bold text-red-500 mt-1 ml-1 animate-fade-in">{usernameError}</p>
                    ) : (
                      <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5 ml-1">3–20 characters, alphanumeric & underscores</p>
                    )}
                  </div>

                  <div>
                    <input
                      type="password"
                      className={`w-full border rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 transition-all ${passwordError ? 'border-red-400 focus:ring-red-500/20 bg-red-50' : 'border-gray-200 focus:ring-blue-500 focus:bg-white bg-gray-50'}`}
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
                    {passwordError ? (
                      <p className="text-[11px] font-bold text-red-500 mt-1.5 ml-1 animate-fade-in">{passwordError}</p>
                    ) : (
                      <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5 ml-1">Include at least 1 letter and 1 number</p>
                    )}
                  </div>

                  <div>
                    <input
                      className={`w-full border rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 transition-all ${emailError ? 'border-red-400 focus:ring-red-500/20 bg-red-50' : 'border-gray-200 focus:ring-blue-500 focus:bg-white bg-gray-50'}`}
                      placeholder="hello@example.com"
                      type="email"
                      required
                      value={regForm.email}
                      onChange={(e) => setRegForm(f => ({ ...f, email: e.target.value }))}
                    />
                    {emailError && (
                      <p className="text-[11px] font-bold text-red-500 mt-1 ml-1 animate-fade-in">{emailError}</p>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono tracking-[0.5em] text-center"
                      placeholder="6-Digit Backup PIN"
                      value={regForm.pin}
                      onChange={(e) => setRegForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
                    />
                    <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5 ml-1 text-center">
                      In case you forget your password, this PIN will be required to get your chat history back.
                    </p>
                  </div>

                  <button
                    disabled={loading || !isFormValid}
                    className="w-full py-3 mt-2 rounded-xl bg-blue-600 text-white font-medium text-sm sm:text-base hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating account...' : 'Create Account'}
                  </button>
                </form>
              )}

              {/* 🔥 NEW UI: Forgot Password (Username Flow) */}
              {tab === 'forgot' && (
                <div className="animate-fade-in flex flex-col items-center">
                  
                  {isResetSent ? (
                    <div className="flex flex-col items-center text-center animate-fade-in">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Check Your Email</h2>
                      <p className="text-[14px] text-gray-500 mt-2 mb-6 px-4">
                        We have sent the reset link to <span className="font-semibold text-gray-900">{resetEmailTarget}</span> successfully.
                      </p>
                      <button 
                        onClick={() => {
                          setTab('login');
                          setIsResetSent(false);
                          setForgotUsername('');
                        }}
                        className="w-full py-3 rounded-xl bg-gray-100 text-gray-900 font-bold text-sm sm:text-base hover:bg-gray-200 transition-all active:scale-[0.98]"
                      >
                        Back to Login
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-gray-900 tracking-tight text-center">Reset Password</h2>
                      <p className="text-[14px] text-gray-500 text-center mt-2 mb-6">
                        Enter your username and we'll send a reset link to your registered email.
                      </p>

                      <form onSubmit={handleForgotPassword} className="w-full space-y-4">
                        <input
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          placeholder="Enter your username"
                          type="text"
                          required
                          value={forgotUsername}
                          onChange={(e) => setForgotUsername(e.target.value)}
                        />

                        <button
                          disabled={loading}
                          type="submit"
                          className="w-full py-3 mt-2 rounded-xl bg-blue-600 text-white font-medium text-sm sm:text-base hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100"
                        >
                          {loading ? 'Sending Link...' : 'Reset Password'}
                        </button>
                      </form>

                      <button 
                        onClick={() => {
                          setTab('login');
                          setForgotUsername('');
                        }}
                        className="mt-6 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                      >
                        Back to Login
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}