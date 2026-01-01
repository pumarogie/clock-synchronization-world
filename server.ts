/**
 * Scalable Video Sync Server
 *
 * Production-ready architecture for 100,000+ concurrent users:
 * - Redis pub/sub for cross-server communication
 * - Room-based sharding for efficient broadcasting
 * - Rate limiting for abuse prevention
 * - Message batching for reduced overhead
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import next from "next";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";

// Import scaling modules
import {
  initRedis,
  getPubSubClients,
  isRedisConnected,
  closeRedis,
} from "./lib/redis";
import roomManager, { User, CursorData, VideoState } from "./lib/roomManager";
import {
  checkRateLimit,
  checkConnectionLimit,
  RateLimitAction,
} from "./lib/rateLimiter";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface CityInfo {
  name: string;
  flag: string;
  timezone: string;
}

interface Reaction {
  id: string;
  userId: string;
  city: string;
  flag: string;
  emoji: string;
  x: number;
  y: number;
  videoTime: number;
  timestamp: number;
}

interface SocketData {
  userId: string;
  userData: User;
  currentRoom: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const INSTANCE_ID = process.env.INSTANCE_ID || `instance-${process.pid}`;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ═══════════════════════════════════════════════════════════════════
// TIMEZONE MAPPING
// ═══════════════════════════════════════════════════════════════════

const TIMEZONE_MAP: Record<string, { name: string; flag: string }> = {
  // Europe
  "Europe/Berlin": { name: "Berlin", flag: "🇩🇪" },
  "Europe/London": { name: "London", flag: "🇬🇧" },
  "Europe/Paris": { name: "Paris", flag: "🇫🇷" },
  "Europe/Rome": { name: "Rome", flag: "🇮🇹" },
  "Europe/Madrid": { name: "Madrid", flag: "🇪🇸" },
  "Europe/Amsterdam": { name: "Amsterdam", flag: "🇳🇱" },
  "Europe/Vienna": { name: "Vienna", flag: "🇦🇹" },
  "Europe/Zurich": { name: "Zurich", flag: "🇨🇭" },
  "Europe/Stockholm": { name: "Stockholm", flag: "🇸🇪" },
  "Europe/Oslo": { name: "Oslo", flag: "🇳🇴" },
  "Europe/Copenhagen": { name: "Copenhagen", flag: "🇩🇰" },
  "Europe/Helsinki": { name: "Helsinki", flag: "🇫🇮" },
  "Europe/Warsaw": { name: "Warsaw", flag: "🇵🇱" },
  "Europe/Prague": { name: "Prague", flag: "🇨🇿" },
  "Europe/Brussels": { name: "Brussels", flag: "🇧🇪" },
  "Europe/Dublin": { name: "Dublin", flag: "🇮🇪" },
  "Europe/Lisbon": { name: "Lisbon", flag: "🇵🇹" },
  "Europe/Athens": { name: "Athens", flag: "🇬🇷" },
  "Europe/Moscow": { name: "Moscow", flag: "🇷🇺" },
  // Americas
  "America/New_York": { name: "New York", flag: "🇺🇸" },
  "America/Los_Angeles": { name: "Los Angeles", flag: "🇺🇸" },
  "America/Chicago": { name: "Chicago", flag: "🇺🇸" },
  "America/Denver": { name: "Denver", flag: "🇺🇸" },
  "America/Toronto": { name: "Toronto", flag: "🇨🇦" },
  "America/Vancouver": { name: "Vancouver", flag: "🇨🇦" },
  "America/Mexico_City": { name: "Mexico City", flag: "🇲🇽" },
  "America/Sao_Paulo": { name: "São Paulo", flag: "🇧🇷" },
  "America/Buenos_Aires": { name: "Buenos Aires", flag: "🇦🇷" },
  // Asia
  "Asia/Tokyo": { name: "Tokyo", flag: "🇯🇵" },
  "Asia/Shanghai": { name: "Shanghai", flag: "🇨🇳" },
  "Asia/Hong_Kong": { name: "Hong Kong", flag: "🇭🇰" },
  "Asia/Singapore": { name: "Singapore", flag: "🇸🇬" },
  "Asia/Seoul": { name: "Seoul", flag: "🇰🇷" },
  "Asia/Dubai": { name: "Dubai", flag: "🇦🇪" },
  "Asia/Kolkata": { name: "Mumbai", flag: "🇮🇳" },
  "Asia/Bangkok": { name: "Bangkok", flag: "🇹🇭" },
  "Asia/Jakarta": { name: "Jakarta", flag: "🇮🇩" },
  // Oceania
  "Australia/Sydney": { name: "Sydney", flag: "🇦🇺" },
  "Australia/Melbourne": { name: "Melbourne", flag: "🇦🇺" },
  "Pacific/Auckland": { name: "Auckland", flag: "🇳🇿" },
  // Africa
  "Africa/Cairo": { name: "Cairo", flag: "🇪🇬" },
  "Africa/Johannesburg": { name: "Johannesburg", flag: "🇿🇦" },
  "Africa/Lagos": { name: "Lagos", flag: "🇳🇬" },
};

function getCityFromTimezone(timezone: string): CityInfo {
  if (TIMEZONE_MAP[timezone]) {
    return { ...TIMEZONE_MAP[timezone], timezone };
  }
  const parts = timezone.split("/");
  const cityName = parts[parts.length - 1].replace(/_/g, " ");
  let flag = "🌍";
  if (timezone.startsWith("Europe/")) flag = "🇪🇺";
  else if (timezone.startsWith("America/")) flag = "🌎";
  else if (timezone.startsWith("Asia/")) flag = "🌏";
  else if (timezone.startsWith("Australia/") || timezone.startsWith("Pacific/"))
    flag = "🌏";
  else if (timezone.startsWith("Africa/")) flag = "🌍";
  return { name: cityName, flag, timezone };
}

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════

function generateUserId(): string {
  return `user_${Math.random().toString(36).substring(2, 9)}`;
}

let reactionCounter = 0;
function generateReactionId(): string {
  reactionCounter++;
  return `reaction_${Date.now()}_${reactionCounter}_${Math.random().toString(36).substring(2, 9)}`;
}

// ═══════════════════════════════════════════════════════════════════
// MESSAGE BATCHING
// ═══════════════════════════════════════════════════════════════════

// Batch cursor updates per room (send every 100ms instead of every update)
const cursorBatches = new Map<string, Map<string, CursorData>>();
const CURSOR_BATCH_INTERVAL = 100; // ms

function batchCursorUpdate(roomId: string, cursorData: CursorData): void {
  if (!cursorBatches.has(roomId)) {
    cursorBatches.set(roomId, new Map());
  }
  cursorBatches.get(roomId)!.set(cursorData.userId, cursorData);
}

// Batch reaction updates (group by 100ms windows)
const reactionBatches = new Map<string, Reaction[]>();
const REACTION_BATCH_INTERVAL = 100; // ms

function batchReaction(roomId: string, reaction: Reaction): void {
  if (!reactionBatches.has(roomId)) {
    reactionBatches.set(roomId, []);
  }
  reactionBatches.get(roomId)!.push(reaction);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SERVER
// ═══════════════════════════════════════════════════════════════════

async function startServer(): Promise<void> {
  // Initialize Redis (optional - server works without it)
  const { pubClient, subClient } = await initRedis();

  // Ensure default room exists
  await roomManager.ensureDefaultRoom();

  await app.prepare();

  const httpServer = createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const parsedUrl = parse(req.url || "", true);
      handle(req, res, parsedUrl);
    },
  );

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    // Connection settings for scale
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
    allowUpgrades: true,
  });

  // Use Redis adapter if connected (enables multi-server clustering)
  if (pubClient && subClient) {
    io.adapter(createAdapter(pubClient, subClient));
    console.log(`[${INSTANCE_ID}] Redis adapter enabled - cluster mode active`);
  } else {
    console.log(`[${INSTANCE_ID}] Running in standalone mode (no Redis)`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONNECTION HANDLING
  // ═══════════════════════════════════════════════════════════════════

  io.on("connection", async (socket: Socket) => {
    // Rate limit connections by IP
    const clientIP = socket.handshake.address;
    if (!checkConnectionLimit(clientIP, 20)) {
      console.log(`Connection rate limited: ${clientIP}`);
      socket.disconnect(true);
      return;
    }

    const userId = generateUserId();
    const clientTimezone = (socket.handshake.query.timezone as string) || "UTC";
    const requestedRoom =
      (socket.handshake.query.room as string) || roomManager.DEFAULT_ROOM_ID;
    const userCity = getCityFromTimezone(clientTimezone);

    const userData: User = {
      id: userId,
      city: userCity.name,
      timezone: userCity.timezone,
      flag: userCity.flag,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      instance: INSTANCE_ID,
    };

    // Store user data in socket for easy access
    const socketData = socket.data as SocketData;
    socketData.userId = userId;
    socketData.userData = userData;
    socketData.currentRoom = null;

    console.log(
      `[${INSTANCE_ID}] User connected: ${userId} from ${userCity.name}`,
    );

    // Send user their own data
    socket.emit("user:self", userData);

    // ═══════════════════════════════════════════════════════════════════
    // ROOM MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    async function joinRoom(roomId: string): Promise<boolean> {
      const data = socket.data as SocketData;

      // Leave current room if any
      if (data.currentRoom) {
        await leaveRoom(data.currentRoom);
      }

      // Rate limit room joins
      const rateCheck = await checkRateLimit(
        userId,
        "roomJoin" as RateLimitAction,
      );
      if (!rateCheck.allowed) {
        socket.emit("error:ratelimit", {
          action: "roomJoin",
          retryIn: rateCheck.resetIn,
        });
        return false;
      }

      // Ensure room exists
      let room = await roomManager.getRoom(roomId);
      if (!room) {
        room = await roomManager.createRoom(roomId, userId);
      }

      // Join Socket.io room
      socket.join(roomId);
      data.currentRoom = roomId;

      // Add user to room in Redis/memory
      await roomManager.addUserToRoom(roomId, userData);

      // Get current room state
      const videoState = await roomManager.getVideoState(roomId);
      const users = await roomManager.getRoomUsers(roomId);

      // Send room state to new user
      socket.emit("room:joined", {
        roomId,
        room,
        videoState,
        users: Object.values(users),
      });

      // Notify others in room
      socket.to(roomId).emit("user:joined", userData);

      // Broadcast updated user list to room
      io.to(roomId).emit("users:list", Object.values(users));

      console.log(`[${INSTANCE_ID}] ${userId} joined room ${roomId}`);
      return true;
    }

    async function leaveRoom(roomId: string | null): Promise<void> {
      if (!roomId) return;
      const data = socket.data as SocketData;

      socket.leave(roomId);
      await roomManager.removeUserFromRoom(roomId, userId);
      await roomManager.removeCursor(roomId, userId);

      // Notify others
      socket.to(roomId).emit("user:left", { userId });
      socket.to(roomId).emit("cursor:remove", userId);

      // Update user list
      const users = await roomManager.getRoomUsers(roomId);
      io.to(roomId).emit("users:list", Object.values(users));

      data.currentRoom = null;
      console.log(`[${INSTANCE_ID}] ${userId} left room ${roomId}`);
    }

    // Auto-join requested room
    await joinRoom(requestedRoom);

    // Handle room join request
    socket.on("room:join", async (roomId: string) => {
      await joinRoom(roomId || roomManager.DEFAULT_ROOM_ID);
    });

    // Handle room leave request
    socket.on("room:leave", async () => {
      const data = socket.data as SocketData;
      await leaveRoom(data.currentRoom);
    });

    // Get available rooms
    socket.on("rooms:list", async (callback: (rooms: unknown[]) => void) => {
      const rooms = await roomManager.getAllRooms();
      const roomsWithCounts = await Promise.all(
        rooms.map(async (room) => ({
          ...room,
          userCount: await roomManager.getRoomUserCount(room.id),
        })),
      );
      callback?.(roomsWithCounts);
    });

    // ═══════════════════════════════════════════════════════════════════
    // TIME SYNC
    // ═══════════════════════════════════════════════════════════════════

    socket.on("time:sync", async (clientTimestamp: number) => {
      const rateCheck = await checkRateLimit(userId, "sync" as RateLimitAction);
      if (!rateCheck.allowed) return;

      const serverReceiveTime = Date.now();
      socket.emit("time:sync:response", {
        clientTimestamp,
        serverReceiveTime,
        serverSendTime: Date.now(),
      });
    });

    // ═══════════════════════════════════════════════════════════════════
    // VIDEO SYNC (Room-scoped)
    // ═══════════════════════════════════════════════════════════════════

    socket.on("video:play", async () => {
      const data = socket.data as SocketData;
      const roomId = data.currentRoom;
      if (!roomId) return;

      const rateCheck = await checkRateLimit(
        userId,
        "videoControl" as RateLimitAction,
      );
      if (!rateCheck.allowed) return;

      const state = await roomManager.updateVideoTime(roomId);
      state.isPlaying = true;
      state.lastUpdateTime = Date.now();
      await roomManager.setVideoState(roomId, state);

      console.log(
        `[${INSTANCE_ID}] Video play in ${roomId} by ${userData.city}`,
      );
      io.to(roomId).emit("video:state", state);
    });

    socket.on("video:pause", async () => {
      const data = socket.data as SocketData;
      const roomId = data.currentRoom;
      if (!roomId) return;

      const rateCheck = await checkRateLimit(
        userId,
        "videoControl" as RateLimitAction,
      );
      if (!rateCheck.allowed) return;

      const state = await roomManager.updateVideoTime(roomId);
      state.isPlaying = false;
      await roomManager.setVideoState(roomId, state);

      console.log(
        `[${INSTANCE_ID}] Video pause in ${roomId} by ${userData.city}`,
      );
      io.to(roomId).emit("video:state", state);
    });

    socket.on("video:seek", async (time: number) => {
      const data = socket.data as SocketData;
      const roomId = data.currentRoom;
      if (!roomId) return;

      const rateCheck = await checkRateLimit(
        userId,
        "videoControl" as RateLimitAction,
      );
      if (!rateCheck.allowed) return;

      const state = await roomManager.getVideoState(roomId);
      state.currentTime = Math.max(0, Math.min(time, state.duration));
      state.lastUpdateTime = Date.now();
      await roomManager.setVideoState(roomId, state);

      console.log(
        `[${INSTANCE_ID}] Video seek in ${roomId} to ${time.toFixed(2)}s by ${userData.city}`,
      );
      io.to(roomId).emit("video:state", state);
    });

    // ═══════════════════════════════════════════════════════════════════
    // CURSOR TRACKING (Batched)
    // ═══════════════════════════════════════════════════════════════════

    socket.on("cursor:move", async ({ x, y }: { x: number; y: number }) => {
      const data = socket.data as SocketData;
      const roomId = data.currentRoom;
      if (!roomId) return;

      const rateCheck = await checkRateLimit(
        userId,
        "cursor" as RateLimitAction,
      );
      if (!rateCheck.allowed) return;

      const cursorData: CursorData = {
        userId: userData.id,
        city: userData.city,
        flag: userData.flag,
        x,
        y,
        timestamp: Date.now(),
      };

      // Batch cursor updates
      batchCursorUpdate(roomId, cursorData);

      // Also update in Redis for persistence
      await roomManager.updateCursor(roomId, userId, cursorData);
    });

    // ═══════════════════════════════════════════════════════════════════
    // REACTIONS (Batched)
    // ═══════════════════════════════════════════════════════════════════

    socket.on(
      "reaction:send",
      async ({
        emoji,
        x,
        y,
        videoTime,
      }: {
        emoji: string;
        x: number;
        y: number;
        videoTime: number;
      }) => {
        const data = socket.data as SocketData;
        const roomId = data.currentRoom;
        if (!roomId) return;

        const rateCheck = await checkRateLimit(
          userId,
          "reaction" as RateLimitAction,
        );
        if (!rateCheck.allowed) return;

        const reaction: Reaction = {
          id: generateReactionId(),
          userId: userData.id,
          city: userData.city,
          flag: userData.flag,
          emoji,
          x,
          y,
          videoTime,
          timestamp: Date.now(),
        };

        // Batch reaction
        batchReaction(roomId, reaction);

        console.log(
          `[${INSTANCE_ID}] Reaction ${emoji} in ${roomId} from ${userData.city}`,
        );
      },
    );

    // ═══════════════════════════════════════════════════════════════════
    // HEARTBEAT
    // ═══════════════════════════════════════════════════════════════════

    socket.on("heartbeat", async () => {
      const data = socket.data as SocketData;
      const roomId = data.currentRoom;
      if (!roomId) return;

      userData.lastSeen = Date.now();
      await roomManager.addUserToRoom(roomId, userData);
    });

    // ═══════════════════════════════════════════════════════════════════
    // DISCONNECT
    // ═══════════════════════════════════════════════════════════════════

    socket.on("disconnect", async () => {
      const data = socket.data as SocketData;
      console.log(`[${INSTANCE_ID}] User disconnected: ${userId}`);
      await leaveRoom(data.currentRoom);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // BATCH FLUSH INTERVALS
  // ═══════════════════════════════════════════════════════════════════

  // Flush cursor batches every CURSOR_BATCH_INTERVAL
  setInterval(() => {
    for (const [roomId, cursors] of cursorBatches.entries()) {
      if (cursors.size > 0) {
        // Send all cursors as a batch
        io.to(roomId).emit("cursors:batch", Array.from(cursors.values()));
        cursors.clear();
      }
    }
  }, CURSOR_BATCH_INTERVAL);

  // Flush reaction batches every REACTION_BATCH_INTERVAL
  setInterval(() => {
    for (const [roomId, reactions] of reactionBatches.entries()) {
      if (reactions.length > 0) {
        // Send all reactions as a batch
        io.to(roomId).emit("reactions:batch", reactions);
        reactionBatches.set(roomId, []);
      }
    }
  }, REACTION_BATCH_INTERVAL);

  // ═══════════════════════════════════════════════════════════════════
  // PERIODIC TASKS
  // ═══════════════════════════════════════════════════════════════════

  // Broadcast server time every second (for sync verification)
  setInterval(() => {
    io.emit("server:time", Date.now());
  }, 1000);

  // Update and broadcast video state every 500ms per room
  setInterval(async () => {
    const rooms = await roomManager.getAllRooms();
    for (const room of rooms) {
      try {
        const state = await roomManager.updateVideoTime(room.id);
        io.to(room.id).emit("video:state", state);
      } catch (err) {
        console.error(`Error updating video state for room ${room.id}:`, err);
      }
    }
  }, 500);

  // Clean up empty rooms every minute
  setInterval(async () => {
    await roomManager.cleanupEmptyRooms();
  }, 60000);

  // ═══════════════════════════════════════════════════════════════════
  // GRACEFUL SHUTDOWN
  // ═══════════════════════════════════════════════════════════════════

  process.on("SIGTERM", async () => {
    console.log(
      `[${INSTANCE_ID}] SIGTERM received, shutting down gracefully...`,
    );

    // Close all connections
    io.close();

    // Close Redis
    await closeRedis();

    // Close HTTP server
    httpServer.close(() => {
      console.log(`[${INSTANCE_ID}] Server closed`);
      process.exit(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // START SERVER
  // ═══════════════════════════════════════════════════════════════════

  httpServer.listen(port, () => {
    const redisStatus = isRedisConnected()
      ? "✅ Redis Connected (Cluster Mode)"
      : "⚠️  Standalone Mode (No Redis)";

    console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   🌍 Scalable Video Sync Server                                      ║
║   Instance: ${INSTANCE_ID.padEnd(50)}║
║                                                                      ║
║   Local:   http://${hostname}:${port}                                     ║
║                                                                      ║
║   ${redisStatus.padEnd(62)}║
║                                                                      ║
║   Features:                                                          ║
║   • Room-based sharding for efficient broadcasting                   ║
║   • Rate limiting (cursors: 20/s, reactions: 5/s)                    ║
║   • Message batching (100ms cursor/reaction batches)                 ║
║   • Graceful shutdown with connection draining                       ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
    `);
  });
}

// Start the server
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
