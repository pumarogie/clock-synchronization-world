/**
 * Redis Client Singleton
 *
 * Provides a shared Redis client for:
 * - Socket.io adapter (pub/sub)
 * - Room state persistence
 * - Rate limiting
 * - User session management
 */

import { createClient, RedisClientType } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redisClient: RedisClientType | null = null;
let pubClient: RedisClientType | null = null;
let subClient: RedisClientType | null = null;
let isConnectedFlag = false;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface RedisClients {
  redisClient: RedisClientType | null;
  pubClient: RedisClientType | null;
  subClient: RedisClientType | null;
}

export interface PubSubClients {
  pubClient: RedisClientType | null;
  subClient: RedisClientType | null;
}

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Initialize Redis connections
 * Creates main client + pub/sub clients for Socket.io adapter
 */
export async function initRedis(): Promise<RedisClients> {
  if (isConnectedFlag) {
    return { redisClient, pubClient, subClient };
  }

  try {
    // Main Redis client for general operations
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            console.error("Redis: Max reconnection attempts reached");
            return new Error("Max reconnection attempts reached");
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    // Pub/Sub clients for Socket.io adapter
    pubClient = redisClient.duplicate();
    subClient = redisClient.duplicate();

    // Error handlers
    redisClient.on("error", (err: Error) =>
      console.error("Redis Client Error:", err),
    );
    pubClient.on("error", (err: Error) =>
      console.error("Redis Pub Error:", err),
    );
    subClient.on("error", (err: Error) =>
      console.error("Redis Sub Error:", err),
    );

    // Connection handlers
    redisClient.on("connect", () =>
      console.log("Redis: Main client connected"),
    );
    pubClient.on("connect", () => console.log("Redis: Pub client connected"));
    subClient.on("connect", () => console.log("Redis: Sub client connected"));

    // Connect all clients
    await Promise.all([
      redisClient.connect(),
      pubClient.connect(),
      subClient.connect(),
    ]);

    isConnectedFlag = true;
    console.log("Redis: All clients initialized successfully");

    return { redisClient, pubClient, subClient };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Redis: Failed to initialize:", errorMessage);
    // Return null clients - server will run in standalone mode
    return { redisClient: null, pubClient: null, subClient: null };
  }
}

/**
 * Get the main Redis client
 */
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

/**
 * Get pub/sub clients for Socket.io adapter
 */
export function getPubSubClients(): PubSubClients {
  return { pubClient, subClient };
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return isConnectedFlag && (redisClient?.isOpen ?? false);
}

/**
 * Graceful shutdown
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    await pubClient?.quit();
    await subClient?.quit();
    isConnectedFlag = false;
    console.log("Redis: Connections closed");
  }
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS FOR COMMON OPERATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Set a value with optional expiration
 */
export async function setWithExpiry<T>(
  key: string,
  value: T,
  expirySeconds: number = 3600,
): Promise<boolean> {
  if (!redisClient?.isOpen) return false;
  await redisClient.set(key, JSON.stringify(value), { EX: expirySeconds });
  return true;
}

/**
 * Get and parse a JSON value
 */
export async function getJSON<T>(key: string): Promise<T | null> {
  if (!redisClient?.isOpen) return null;
  const value = await redisClient.get(key);
  return value ? (JSON.parse(value) as T) : null;
}

/**
 * Set a hash value
 */
export async function setHash<T>(
  key: string,
  field: string,
  value: T,
): Promise<boolean> {
  if (!redisClient?.isOpen) return false;
  await redisClient.hSet(key, field, JSON.stringify(value));
  return true;
}

/**
 * Get all hash values
 */
export async function getHashAll<T>(key: string): Promise<Record<string, T>> {
  if (!redisClient?.isOpen) return {};
  const hash = await redisClient.hGetAll(key);
  const result: Record<string, T> = {};
  for (const [field, value] of Object.entries(hash)) {
    try {
      result[field] = JSON.parse(value) as T;
    } catch {
      result[field] = value as unknown as T;
    }
  }
  return result;
}

/**
 * Delete a hash field
 */
export async function deleteHashField(
  key: string,
  field: string,
): Promise<boolean> {
  if (!redisClient?.isOpen) return false;
  await redisClient.hDel(key, field);
  return true;
}

/**
 * Increment a counter with expiry (for rate limiting)
 */
export async function incrementWithExpiry(
  key: string,
  expirySeconds: number = 1,
): Promise<number> {
  if (!redisClient?.isOpen) return 0;
  const count = await redisClient.incr(key);
  if (count === 1) {
    await redisClient.expire(key, expirySeconds);
  }
  return count;
}

/**
 * Add to a sorted set with score (for leaderboards, etc.)
 */
export async function addToSortedSet(
  key: string,
  score: number,
  member: string,
): Promise<boolean> {
  if (!redisClient?.isOpen) return false;
  await redisClient.zAdd(key, { score, value: member });
  return true;
}

/**
 * Get members from sorted set by score range
 */
export async function getSortedSetRange(
  key: string,
  start: number = 0,
  end: number = -1,
): Promise<string[]> {
  if (!redisClient?.isOpen) return [];
  return await redisClient.zRange(key, start, end);
}

export default {
  initRedis,
  getRedisClient,
  getPubSubClients,
  isRedisConnected,
  closeRedis,
  setWithExpiry,
  getJSON,
  setHash,
  getHashAll,
  deleteHashField,
  incrementWithExpiry,
  addToSortedSet,
  getSortedSetRange,
};
