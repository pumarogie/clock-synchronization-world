/**
 * Room Manager
 * 
 * Handles room-based sharding for scalable video sync:
 * - Room creation and deletion
 * - User membership tracking
 * - Room state management
 * - Cross-server room state via Redis
 */

import { 
  getRedisClient, 
  isRedisConnected,
  setHash,
  getHashAll,
  deleteHashField,
  setWithExpiry,
  getJSON
} from './redis';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface Room {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  maxUsers: number;
  isPublic: boolean;
}

export interface RoomOptions {
  name?: string;
  maxUsers?: number;
  isPublic?: boolean;
}

export interface User {
  id: string;
  city: string;
  timezone: string;
  flag: string;
  connectedAt: number;
  lastSeen: number;
  instance?: string;
}

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  serverTimestamp: number;
  lastUpdateTime: number;
}

export interface CursorData {
  userId: string;
  city: string;
  flag: string;
  x: number;
  y: number;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

// Room TTL (24 hours) - inactive rooms are cleaned up
const ROOM_TTL = 60 * 60 * 24;

// In-memory fallback when Redis is unavailable
const localRooms = new Map<string, Room>();
const localRoomUsers = new Map<string, Map<string, User>>();
const localVideoStates = new Map<string, VideoState>();

// ═══════════════════════════════════════════════════════════════════
// ROOM KEYS
// ═══════════════════════════════════════════════════════════════════

const KEYS = {
  roomMeta: (roomId: string) => `room:${roomId}:meta`,
  roomUsers: (roomId: string) => `room:${roomId}:users`,
  roomVideo: (roomId: string) => `room:${roomId}:video`,
  roomCursors: (roomId: string) => `room:${roomId}:cursors`,
  allRooms: 'rooms:all',
};

// ═══════════════════════════════════════════════════════════════════
// ROOM OPERATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a new room or get existing one
 */
export async function createRoom(roomId: string, creatorId: string, options: RoomOptions = {}): Promise<Room> {
  const roomData: Room = {
    id: roomId,
    name: options.name || `Room ${roomId}`,
    createdBy: creatorId,
    createdAt: Date.now(),
    maxUsers: options.maxUsers || 10000,
    isPublic: options.isPublic !== false,
  };

  if (isRedisConnected()) {
    const redis = getRedisClient();
    if (redis) {
      await redis.hSet(KEYS.allRooms, roomId, JSON.stringify(roomData));
      await setWithExpiry(KEYS.roomMeta(roomId), roomData, ROOM_TTL);
    }
  } else {
    localRooms.set(roomId, roomData);
  }

  console.log(`Room created: ${roomId} by ${creatorId}`);
  return roomData;
}

/**
 * Get room metadata
 */
export async function getRoom(roomId: string): Promise<Room | null> {
  if (isRedisConnected()) {
    return await getJSON<Room>(KEYS.roomMeta(roomId));
  }
  return localRooms.get(roomId) || null;
}

/**
 * Get all active rooms
 */
export async function getAllRooms(): Promise<Room[]> {
  if (isRedisConnected()) {
    const redis = getRedisClient();
    if (redis) {
      const rooms = await redis.hGetAll(KEYS.allRooms);
      return Object.values(rooms).map(r => JSON.parse(r as string) as Room);
    }
  }
  return Array.from(localRooms.values());
}

/**
 * Delete a room
 */
export async function deleteRoom(roomId: string): Promise<void> {
  if (isRedisConnected()) {
    const redis = getRedisClient();
    if (redis) {
      await redis.hDel(KEYS.allRooms, roomId);
      await redis.del(KEYS.roomMeta(roomId));
      await redis.del(KEYS.roomUsers(roomId));
      await redis.del(KEYS.roomVideo(roomId));
      await redis.del(KEYS.roomCursors(roomId));
    }
  } else {
    localRooms.delete(roomId);
    localRoomUsers.delete(roomId);
    localVideoStates.delete(roomId);
  }
  console.log(`Room deleted: ${roomId}`);
}

// ═══════════════════════════════════════════════════════════════════
// USER MEMBERSHIP
// ═══════════════════════════════════════════════════════════════════

/**
 * Add user to a room
 */
export async function addUserToRoom(roomId: string, userData: User): Promise<void> {
  if (isRedisConnected()) {
    await setHash(KEYS.roomUsers(roomId), userData.id, userData);
    // Refresh room TTL
    const redis = getRedisClient();
    if (redis) {
      await redis.expire(KEYS.roomUsers(roomId), ROOM_TTL);
    }
  } else {
    if (!localRoomUsers.has(roomId)) {
      localRoomUsers.set(roomId, new Map());
    }
    localRoomUsers.get(roomId)!.set(userData.id, userData);
  }
  console.log(`User ${userData.id} joined room ${roomId}`);
}

/**
 * Remove user from a room
 */
export async function removeUserFromRoom(roomId: string, userId: string): Promise<void> {
  if (isRedisConnected()) {
    await deleteHashField(KEYS.roomUsers(roomId), userId);
    await deleteHashField(KEYS.roomCursors(roomId), userId);
  } else {
    localRoomUsers.get(roomId)?.delete(userId);
  }
  console.log(`User ${userId} left room ${roomId}`);
}

/**
 * Get all users in a room
 */
export async function getRoomUsers(roomId: string): Promise<Record<string, User>> {
  if (isRedisConnected()) {
    return await getHashAll<User>(KEYS.roomUsers(roomId));
  }
  const users = localRoomUsers.get(roomId);
  return users ? Object.fromEntries(users) : {};
}

/**
 * Get user count in a room
 */
export async function getRoomUserCount(roomId: string): Promise<number> {
  if (isRedisConnected()) {
    const redis = getRedisClient();
    if (redis) {
      return await redis.hLen(KEYS.roomUsers(roomId));
    }
  }
  return localRoomUsers.get(roomId)?.size || 0;
}

// ═══════════════════════════════════════════════════════════════════
// VIDEO STATE
// ═══════════════════════════════════════════════════════════════════

/**
 * Default video state for new rooms
 */
function getDefaultVideoState(): VideoState {
  return {
    isPlaying: false,
    currentTime: 0,
    duration: 596, // Big Buck Bunny duration
    serverTimestamp: Date.now(),
    lastUpdateTime: Date.now(),
  };
}

/**
 * Get video state for a room
 */
export async function getVideoState(roomId: string): Promise<VideoState> {
  if (isRedisConnected()) {
    const state = await getJSON<VideoState>(KEYS.roomVideo(roomId));
    return state || getDefaultVideoState();
  }
  return localVideoStates.get(roomId) || getDefaultVideoState();
}

/**
 * Set video state for a room
 */
export async function setVideoState(roomId: string, state: Partial<VideoState>): Promise<VideoState> {
  const currentState = await getVideoState(roomId);
  const videoState: VideoState = {
    ...currentState,
    ...state,
    serverTimestamp: Date.now(),
  };

  if (isRedisConnected()) {
    await setWithExpiry(KEYS.roomVideo(roomId), videoState, ROOM_TTL);
  } else {
    localVideoStates.set(roomId, videoState);
  }

  return videoState;
}

/**
 * Update video time based on playback
 */
export async function updateVideoTime(roomId: string): Promise<VideoState> {
  const state = await getVideoState(roomId);
  
  if (state.isPlaying) {
    const now = Date.now();
    const elapsed = (now - state.lastUpdateTime) / 1000;
    state.currentTime = Math.min(state.currentTime + elapsed, state.duration);
    state.lastUpdateTime = now;
    
    // Loop video when it ends
    if (state.currentTime >= state.duration) {
      state.currentTime = 0;
    }
  }
  
  state.serverTimestamp = Date.now();
  await setVideoState(roomId, state);
  
  return state;
}

// ═══════════════════════════════════════════════════════════════════
// CURSOR STATE
// ═══════════════════════════════════════════════════════════════════

/**
 * Update cursor position for a user in a room
 */
export async function updateCursor(roomId: string, userId: string, cursorData: CursorData): Promise<void> {
  if (isRedisConnected()) {
    await setHash(KEYS.roomCursors(roomId), userId, cursorData);
  }
  // Cursors are ephemeral, no local fallback needed
}

/**
 * Get all cursors in a room
 */
export async function getRoomCursors(roomId: string): Promise<Record<string, CursorData>> {
  if (isRedisConnected()) {
    return await getHashAll<CursorData>(KEYS.roomCursors(roomId));
  }
  return {};
}

/**
 * Remove cursor for a user
 */
export async function removeCursor(roomId: string, userId: string): Promise<void> {
  if (isRedisConnected()) {
    await deleteHashField(KEYS.roomCursors(roomId), userId);
  }
}

// ═══════════════════════════════════════════════════════════════════
// ROOM CLEANUP
// ═══════════════════════════════════════════════════════════════════

/**
 * Clean up empty rooms
 */
export async function cleanupEmptyRooms(): Promise<void> {
  const rooms = await getAllRooms();
  
  for (const room of rooms) {
    const userCount = await getRoomUserCount(room.id);
    if (userCount === 0) {
      const roomData = await getRoom(room.id);
      // Only delete rooms that have been empty for a while
      if (roomData && Date.now() - roomData.createdAt > 60000) {
        await deleteRoom(room.id);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// DEFAULT ROOM
// ═══════════════════════════════════════════════════════════════════

export const DEFAULT_ROOM_ID = 'main-lobby';

/**
 * Ensure the default room exists
 */
export async function ensureDefaultRoom(): Promise<void> {
  const existing = await getRoom(DEFAULT_ROOM_ID);
  if (!existing) {
    await createRoom(DEFAULT_ROOM_ID, 'system', {
      name: 'Main Lobby',
      isPublic: true,
      maxUsers: 100000,
    });
  }
}

export default {
  createRoom,
  getRoom,
  getAllRooms,
  deleteRoom,
  addUserToRoom,
  removeUserFromRoom,
  getRoomUsers,
  getRoomUserCount,
  getVideoState,
  setVideoState,
  updateVideoTime,
  updateCursor,
  getRoomCursors,
  removeCursor,
  cleanupEmptyRooms,
  ensureDefaultRoom,
  DEFAULT_ROOM_ID,
};

