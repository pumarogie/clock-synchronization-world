"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface User {
  id: string;
  city: string;
  timezone: string;
  flag: string;
  connectedAt: number;
  lastSeen: number;
  instance?: string;
}

export interface Room {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  maxUsers: number;
  isPublic: boolean;
  userCount?: number;
}

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  serverTimestamp: number;
}

export interface RateLimitError {
  action: string;
  retryIn: number;
  message: string;
}

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  currentUser: User | null;
  users: User[];
  serverTime: number;
  // Room management
  currentRoom: string | null;
  rooms: Room[];
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  fetchRooms: () => Promise<Room[]>;
  // Error handling
  lastError: RateLimitError | null;
  clearError: () => void;
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const RECONNECTION_ATTEMPTS = 10;
const RECONNECTION_DELAY = 1000;
const RECONNECTION_DELAY_MAX = 5000;
const HEARTBEAT_INTERVAL = 5000;

// ═══════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════

const defaultValue: SocketContextValue = {
  socket: null,
  isConnected: false,
  isReconnecting: false,
  currentUser: null,
  users: [],
  serverTime: Date.now(),
  currentRoom: null,
  rooms: [],
  joinRoom: () => {},
  leaveRoom: () => {},
  fetchRooms: async () => [],
  lastError: null,
  clearError: () => {},
};

const SocketContext = createContext<SocketContextValue>(defaultValue);

// ═══════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════

export function SocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [serverTime, setServerTime] = useState(Date.now());
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [lastError, setLastError] = useState<RateLimitError | null>(null);

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const lastRoomRef = useRef<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════
  // SOCKET INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  useEffect(() => {
    // Detect user's actual timezone
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Create socket connection with enhanced options
    const newSocket = io({
      transports: ["websocket", "polling"],
      query: {
        timezone: detectedTimezone,
        room: "main-lobby", // Default room
      },
      // Reconnection settings
      reconnection: true,
      reconnectionAttempts: RECONNECTION_ATTEMPTS,
      reconnectionDelay: RECONNECTION_DELAY,
      reconnectionDelayMax: RECONNECTION_DELAY_MAX,
      // Timeout settings
      timeout: 20000,
    });

    setSocket(newSocket);

    // ─────────────────────────────────────────────────────────────────
    // CONNECTION EVENTS
    // ─────────────────────────────────────────────────────────────────

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      setIsConnected(true);
      setIsReconnecting(false);
      reconnectAttempts.current = 0;

      // Rejoin last room on reconnect
      if (lastRoomRef.current) {
        newSocket.emit("room:join", lastRoomRef.current);
      }
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setIsConnected(false);

      // If server initiated disconnect, don't show reconnecting
      if (reason !== "io server disconnect") {
        setIsReconnecting(true);
      }
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      reconnectAttempts.current++;
      setIsReconnecting(true);
    });

    newSocket.io.on("reconnect", (attempt) => {
      console.log("Reconnected after", attempt, "attempts");
      setIsReconnecting(false);
    });

    newSocket.io.on("reconnect_attempt", (attempt) => {
      console.log("Reconnection attempt:", attempt);
      reconnectAttempts.current = attempt;
    });

    newSocket.io.on("reconnect_failed", () => {
      console.error(
        "Reconnection failed after",
        RECONNECTION_ATTEMPTS,
        "attempts",
      );
      setIsReconnecting(false);
    });

    // ─────────────────────────────────────────────────────────────────
    // USER EVENTS
    // ─────────────────────────────────────────────────────────────────

    newSocket.on("user:self", (userData: User) => {
      setCurrentUser(userData);
    });

    newSocket.on("users:list", (userList: User[]) => {
      setUsers(userList);
    });

    newSocket.on("user:joined", (user: User) => {
      setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user]);
    });

    newSocket.on("user:left", ({ userId }: { userId: string }) => {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    });

    // ─────────────────────────────────────────────────────────────────
    // ROOM EVENTS
    // ─────────────────────────────────────────────────────────────────

    newSocket.on(
      "room:joined",
      ({ roomId, room, videoState, users: roomUsers }) => {
        console.log("Joined room:", roomId);
        setCurrentRoom(roomId);
        lastRoomRef.current = roomId;
        setUsers(roomUsers);
      },
    );

    // ─────────────────────────────────────────────────────────────────
    // SERVER TIME
    // ─────────────────────────────────────────────────────────────────

    newSocket.on("server:time", (time: number) => {
      setServerTime(time);
    });

    // ─────────────────────────────────────────────────────────────────
    // ERROR HANDLING
    // ─────────────────────────────────────────────────────────────────

    newSocket.on("error:ratelimit", (error: RateLimitError) => {
      console.warn("Rate limited:", error);
      setLastError(error);
      // Auto-clear error after retry period
      setTimeout(() => setLastError(null), error.retryIn);
    });

    // ─────────────────────────────────────────────────────────────────
    // HEARTBEAT
    // ─────────────────────────────────────────────────────────────────

    heartbeatRef.current = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit("heartbeat");
      }
    }, HEARTBEAT_INTERVAL);

    // ─────────────────────────────────────────────────────────────────
    // CLEANUP
    // ─────────────────────────────────────────────────────────────────

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      newSocket.disconnect();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // ROOM MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  const joinRoom = useCallback(
    (roomId: string) => {
      if (socket?.connected) {
        socket.emit("room:join", roomId);
      }
    },
    [socket],
  );

  const leaveRoom = useCallback(() => {
    if (socket?.connected && currentRoom) {
      socket.emit("room:leave");
      setCurrentRoom(null);
      lastRoomRef.current = null;
    }
  }, [socket, currentRoom]);

  const fetchRooms = useCallback(async (): Promise<Room[]> => {
    return new Promise((resolve) => {
      if (socket?.connected) {
        socket.emit("rooms:list", (roomList: Room[]) => {
          setRooms(roomList);
          resolve(roomList);
        });
      } else {
        resolve([]);
      }
    });
  }, [socket]);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════════════════

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        isReconnecting,
        currentUser,
        users,
        serverTime,
        currentRoom,
        rooms,
        joinRoom,
        leaveRoom,
        fetchRooms,
        lastError,
        clearError,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════

export function useSocketContext() {
  return useContext(SocketContext);
}
