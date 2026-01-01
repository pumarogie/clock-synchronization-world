'use client';

import { useSocketContext } from '../context/SocketContext';

export interface User {
  id: string;
  city: string;
  timezone: string;
  flag: string;
  connectedAt: number;
  lastSeen: number;
}

export function useSocket() {
  const { socket, isConnected, currentUser, users, serverTime } = useSocketContext();

  const requestTimeSync = () => {
    if (socket?.connected) {
      socket.emit('time:sync', Date.now());
    }
  };

  return {
    isConnected,
    users,
    currentUser,
    serverTime,
    error: null,
    requestTimeSync,
  };
}
