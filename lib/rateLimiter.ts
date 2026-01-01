/**
 * Rate Limiter
 *
 * Prevents abuse and reduces server load by limiting:
 * - Cursor updates: max 20/second per user
 * - Reactions: max 5/second per user
 * - Sync requests: max 10/second per user
 * - Messages: max 30/second per user
 *
 * Uses Redis for distributed rate limiting across server cluster,
 * falls back to in-memory for standalone mode.
 */

import { incrementWithExpiry, isRedisConnected } from "./redis";
import type { Socket } from "socket.io";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  count: number;
}

export interface LocalBucket {
  count: number;
  resetAt: number;
}

export type RateLimitAction =
  | "cursor"
  | "reaction"
  | "sync"
  | "message"
  | "roomJoin"
  | "videoControl";

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

// In-memory fallback for standalone mode
const localBuckets = new Map<string, LocalBucket>();

// Rate limit configurations
export const LIMITS: Record<RateLimitAction, RateLimitConfig> = {
  cursor: { max: 20, windowMs: 1000 }, // 20 cursor updates per second
  reaction: { max: 5, windowMs: 1000 }, // 5 reactions per second
  sync: { max: 10, windowMs: 1000 }, // 10 sync requests per second
  message: { max: 30, windowMs: 1000 }, // 30 messages per second
  roomJoin: { max: 5, windowMs: 10000 }, // 5 room joins per 10 seconds
  videoControl: { max: 10, windowMs: 1000 }, // 10 video controls per second
};

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if an action is rate limited
 */
export async function checkRateLimit(
  userId: string,
  action: RateLimitAction,
): Promise<RateLimitResult> {
  const config = LIMITS[action];
  if (!config) {
    console.warn(`Unknown rate limit action: ${action}`);
    return { allowed: true, remaining: Infinity, resetIn: 0, count: 0 };
  }

  const key = `ratelimit:${action}:${userId}`;
  const windowSeconds = Math.ceil(config.windowMs / 1000);

  let count: number;

  if (isRedisConnected()) {
    // Distributed rate limiting via Redis
    count = await incrementWithExpiry(key, windowSeconds);
  } else {
    // Local rate limiting fallback
    count = incrementLocalBucket(key, config.windowMs);
  }

  const allowed = count <= config.max;
  const remaining = Math.max(0, config.max - count);
  const resetIn = config.windowMs;

  return { allowed, remaining, resetIn, count };
}

/**
 * Rate limit middleware for Socket.io events
 */
export function rateLimitMiddleware(action: RateLimitAction) {
  return async (socket: Socket, next?: () => void) => {
    const userId = (socket.data?.userId as string) || socket.id;
    const result = await checkRateLimit(userId, action);

    if (!result.allowed) {
      console.log(
        `Rate limited: ${userId} for ${action} (${result.count}/${LIMITS[action].max})`,
      );
      // Emit rate limit error to client
      socket.emit("error:ratelimit", {
        action,
        retryIn: result.resetIn,
        message: `Rate limit exceeded for ${action}. Try again in ${result.resetIn}ms`,
      });
      return; // Don't call next - block the event
    }

    next?.();
  };
}

/**
 * Create a rate-limited event handler
 */
export function withRateLimit<T extends unknown[]>(
  action: RateLimitAction,
  handler: (socket: Socket, ...args: T) => void | Promise<void>,
) {
  return async (socket: Socket, ...args: T) => {
    const userId = (socket.data?.userId as string) || socket.id;
    const result = await checkRateLimit(userId, action);

    if (!result.allowed) {
      socket.emit("error:ratelimit", {
        action,
        retryIn: result.resetIn,
        message: `Rate limit exceeded for ${action}`,
      });
      return;
    }

    return handler(socket, ...args);
  };
}

// ═══════════════════════════════════════════════════════════════════
// LOCAL RATE LIMITING (In-memory fallback)
// ═══════════════════════════════════════════════════════════════════

/**
 * Increment local bucket and return count
 */
function incrementLocalBucket(key: string, windowMs: number): number {
  const now = Date.now();
  const bucket = localBuckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    // Create new bucket
    localBuckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return 1;
  }

  // Increment existing bucket
  bucket.count++;
  return bucket.count;
}

/**
 * Clean up expired local buckets (call periodically)
 */
export function cleanupLocalBuckets(): void {
  const now = Date.now();
  for (const [key, bucket] of localBuckets.entries()) {
    if (now > bucket.resetAt) {
      localBuckets.delete(key);
    }
  }
}

// Clean up expired buckets every 10 seconds
setInterval(cleanupLocalBuckets, 10000);

// ═══════════════════════════════════════════════════════════════════
// BURST PROTECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Token bucket for smoother rate limiting with burst allowance
 */
export class TokenBucket {
  private maxTokens: number;
  private tokens: number;
  private refillRate: number;
  private refillInterval: number;
  private lastRefill: number;

  constructor(
    maxTokens: number,
    refillRate: number,
    refillInterval: number = 1000,
  ) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.refillInterval = refillInterval;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume a token
   */
  consume(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Refill tokens based on elapsed time
   */
  refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / this.refillInterval) * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Get current token count
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }
}

// User token buckets for smooth rate limiting
const userBuckets = new Map<string, TokenBucket>();

/**
 * Get or create a token bucket for a user
 */
export function getUserBucket(
  userId: string,
  action: RateLimitAction,
): TokenBucket {
  const key = `${action}:${userId}`;

  if (!userBuckets.has(key)) {
    const config = LIMITS[action] || { max: 10, windowMs: 1000 };
    userBuckets.set(
      key,
      new TokenBucket(
        config.max * 2, // Allow 2x burst
        config.max, // Refill at max rate
        config.windowMs, // Per window
      ),
    );
  }

  return userBuckets.get(key)!;
}

/**
 * Check rate limit using token bucket (smoother)
 */
export function checkTokenBucket(
  userId: string,
  action: RateLimitAction,
): boolean {
  const bucket = getUserBucket(userId, action);
  return bucket.consume();
}

// ═══════════════════════════════════════════════════════════════════
// CONNECTION RATE LIMITING
// ═══════════════════════════════════════════════════════════════════

const connectionAttempts = new Map<string, number[]>();

/**
 * Check if IP can create new connection
 */
export function checkConnectionLimit(
  ip: string,
  maxPerMinute: number = 10,
): boolean {
  const now = Date.now();
  const key = `conn:${ip}`;

  const attempts = connectionAttempts.get(key) || [];

  // Remove old attempts (older than 1 minute)
  const recentAttempts = attempts.filter((t) => now - t < 60000);

  if (recentAttempts.length >= maxPerMinute) {
    return false;
  }

  recentAttempts.push(now);
  connectionAttempts.set(key, recentAttempts);

  return true;
}

// Clean up connection attempts every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, attempts] of connectionAttempts.entries()) {
    const recent = attempts.filter((t) => now - t < 60000);
    if (recent.length === 0) {
      connectionAttempts.delete(key);
    } else {
      connectionAttempts.set(key, recent);
    }
  }
}, 60000);

export default {
  checkRateLimit,
  rateLimitMiddleware,
  withRateLimit,
  cleanupLocalBuckets,
  TokenBucket,
  getUserBucket,
  checkTokenBucket,
  checkConnectionLimit,
  LIMITS,
};
