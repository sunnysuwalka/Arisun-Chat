import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    // Changed to process.env.REACT_APP
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
    socket = io(socketUrl, { withCredentials: true });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};