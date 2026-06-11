import { create } from 'zustand';
import api from '../utils/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  privateKeys: null, // 🔥 The decrypted E2EE keys (Memory Only)
  loading: false,
  initialized: false,

  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) { set({ initialized: true }); return; }
    try {
      const res = await api.get('/auth/me');
      // Note: We don't have the private keys here yet because we need the password to unlock them!
      set({ user: res.data, token, initialized: true });
    } catch {
      localStorage.removeItem('token');
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
    // Wipe everything, especially the private keys
    set({ user: null, token: null, privateKeys: null });
  },

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setPrivateKeys: (keys) => set({ privateKeys: keys }) // 🔥 New Setter
}));