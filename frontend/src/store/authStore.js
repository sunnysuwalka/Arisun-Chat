import { create } from 'zustand';
import api from '../utils/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  // 🔥 THE FIX: Moved to localStorage so the Vault stays unlocked even if the browser is closed
  privateKeys: JSON.parse(localStorage.getItem('privateKeys')) || null, 
  loading: false,
  initialized: false,

  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) { set({ initialized: true }); return; }
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data, token, initialized: true });
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('privateKeys'); // Clean up on fail
      set({ user: null, token: null, privateKeys: null, initialized: true });
    }
  },

  login: async (username, password) => {
    set({ loading: true });
    try {
      const res = await api.post('/auth/login', { username, password });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      set({ token, user, loading: false });
      return { success: true, user }; 
    } catch (err) {
      set({ loading: false });
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    // 🔥 THE FIX: Destroy the persistent keys ONLY on manual logout
    localStorage.removeItem('privateKeys'); 
    set({ user: null, token: null, privateKeys: null });
  },

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setPrivateKeys: (keys) => {
    // 🔥 THE FIX: Save to localStorage when unlocked during login/registration
    localStorage.setItem('privateKeys', JSON.stringify(keys)); 
    set({ privateKeys: keys });
  }
}));