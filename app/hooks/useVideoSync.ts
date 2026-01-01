'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocketContext } from '../context/SocketContext';

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  serverTimestamp: number;
}

export interface Cursor {
  userId: string;
  city: string;
  flag: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface Reaction {
  id: string;
  userId: string;
  emoji: string;
  x: number;
  y: number;
  videoTime: number;
  timestamp: number;
}

export interface VideoSyncUser {
  id: string;
  city: string;
  flag: string;
  timezone: string;
}

// ═══════════════════════════════════════════════════════════════════
// SYNC CONFIGURATION - Tuned for optimal performance
// ═══════════════════════════════════════════════════════════════════
const SYNC_CONFIG = {
  // How often to check sync (ms) - 100ms = 10 checks/second for tight sync
  SYNC_INTERVAL: 100,
  
  // Drift thresholds (seconds)
  DRIFT_THRESHOLD_SEEK: 1.5,      // Hard seek if drift > 1.5s (was 2s)
  DRIFT_THRESHOLD_ADJUST: 0.05,   // Start rubber-banding at 50ms drift (was 100ms)
  DRIFT_THRESHOLD_SYNCED: 0.02,   // Consider synced under 20ms
  
  // Playback rate bounds - smoother corrections
  MAX_SPEEDUP: 1.08,              // Max 8% faster (Teleparty uses ~5-10%)
  MAX_SLOWDOWN: 0.92,             // Max 8% slower
  
  // Exponential smoothing factor for drift (0-1, lower = smoother)
  DRIFT_SMOOTHING: 0.3,
  
  // Pause sync briefly after user interaction (ms)
  USER_ACTION_COOLDOWN: 500,
  
  // Network latency compensation
  LATENCY_SAMPLES: 5,             // Keep last N RTT samples
};

export function useVideoSync() {
  const { socket, isConnected, currentUser, users } = useSocketContext();
  
  const [videoState, setVideoState] = useState<VideoState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    serverTimestamp: Date.now(),
  });
  const [cursors, setCursors] = useState<Map<string, Cursor>>(new Map());
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'ahead' | 'behind' | 'seeking' | 'buffering'>('synced');
  const [drift, setDrift] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [networkLatency, setNetworkLatency] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastCursorUpdate = useRef<number>(0);
  const smoothedDrift = useRef<number>(0);
  const lastUserAction = useRef<number>(0);
  const latencySamples = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastSyncTime = useRef<number>(0);

  // Listen to video events from shared socket
  useEffect(() => {
    if (!socket) return;

    const handleVideoState = (state: VideoState) => {
      // Calculate network latency from server timestamp
      const now = Date.now();
      const rtt = now - state.serverTimestamp;
      if (rtt > 0 && rtt < 5000) { // Sanity check
        latencySamples.current = [...latencySamples.current.slice(-(SYNC_CONFIG.LATENCY_SAMPLES - 1)), rtt / 2];
        const avgLatency = latencySamples.current.reduce((a, b) => a + b, 0) / latencySamples.current.length;
        setNetworkLatency(avgLatency);
      }
      setVideoState(state);
    };

    const handleCursorUpdate = (cursor: Cursor) => {
      setCursors(prev => {
        const newCursors = new Map(prev);
        newCursors.set(cursor.userId, cursor);
        return newCursors;
      });
    };

    // Handle batched cursor updates (from scaled server)
    const handleCursorsBatch = (cursorBatch: Cursor[]) => {
      setCursors(prev => {
        const newCursors = new Map(prev);
        for (const cursor of cursorBatch) {
          newCursors.set(cursor.userId, cursor);
        }
        return newCursors;
      });
    };

    const handleCursorRemove = (userId: string) => {
      setCursors(prev => {
        const newCursors = new Map(prev);
        newCursors.delete(userId);
        return newCursors;
      });
    };

    const handleReaction = (reaction: Reaction) => {
      setReactions(prev => [...prev, reaction].slice(-50));
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== reaction.id));
      }, 3000);
    };

    // Handle batched reactions (from scaled server)
    const handleReactionsBatch = (reactionBatch: Reaction[]) => {
      setReactions(prev => {
        const newReactions = [...prev, ...reactionBatch].slice(-50);
        // Schedule cleanup for each reaction
        for (const reaction of reactionBatch) {
          setTimeout(() => {
            setReactions(current => current.filter(r => r.id !== reaction.id));
          }, 3000);
        }
        return newReactions;
      });
    };

    // Subscribe to all events (including batched versions)
    socket.on('video:state', handleVideoState);
    socket.on('cursor:update', handleCursorUpdate);
    socket.on('cursors:batch', handleCursorsBatch);
    socket.on('cursor:remove', handleCursorRemove);
    socket.on('reaction:new', handleReaction);
    socket.on('reactions:batch', handleReactionsBatch);

    return () => {
      socket.off('video:state', handleVideoState);
      socket.off('cursor:update', handleCursorUpdate);
      socket.off('cursors:batch', handleCursorsBatch);
      socket.off('cursor:remove', handleCursorRemove);
      socket.off('reaction:new', handleReaction);
      socket.off('reactions:batch', handleReactionsBatch);
    };
  }, [socket]);

  // Set video reference and attach buffering listeners
  const setVideoRef = useCallback((video: HTMLVideoElement | null) => {
    // Clean up old listeners
    if (videoRef.current) {
      videoRef.current.removeEventListener('waiting', handleBufferingStart);
      videoRef.current.removeEventListener('playing', handleBufferingEnd);
      videoRef.current.removeEventListener('canplay', handleBufferingEnd);
    }
    
    videoRef.current = video;
    
    // Attach buffering detection
    if (video) {
      video.addEventListener('waiting', handleBufferingStart);
      video.addEventListener('playing', handleBufferingEnd);
      video.addEventListener('canplay', handleBufferingEnd);
    }
  }, []);

  // Buffering handlers
  const handleBufferingStart = useCallback(() => {
    setIsBuffering(true);
    setSyncStatus('buffering');
  }, []);

  const handleBufferingEnd = useCallback(() => {
    setIsBuffering(false);
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // CORE SYNC ALGORITHM - Industry-grade implementation
  // ═══════════════════════════════════════════════════════════════════
  const syncVideoPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const now = Date.now();
    
    // Skip sync during cooldown after user actions (prevents fighting user input)
    if (now - lastUserAction.current < SYNC_CONFIG.USER_ACTION_COOLDOWN) {
      return;
    }

    // Skip sync while buffering
    if (isBuffering) {
      return;
    }

    // Calculate expected position with latency compensation
    const timeSinceUpdate = (now - videoState.serverTimestamp) / 1000;
    const latencyCompensation = networkLatency / 1000; // Convert ms to seconds
    const expectedPosition = videoState.isPlaying 
      ? videoState.currentTime + timeSinceUpdate + latencyCompensation
      : videoState.currentTime;
    
    const actualPosition = video.currentTime;
    const rawDrift = expectedPosition - actualPosition;

    // Exponential smoothing to reduce jitter
    smoothedDrift.current = smoothedDrift.current * (1 - SYNC_CONFIG.DRIFT_SMOOTHING) 
                          + rawDrift * SYNC_CONFIG.DRIFT_SMOOTHING;
    const currentDrift = smoothedDrift.current;

    let newSyncStatus: 'synced' | 'ahead' | 'behind' | 'seeking' | 'buffering' = 'synced';
    let newPlaybackRate = 1;

    // Hard seek for large drift
    if (Math.abs(currentDrift) > SYNC_CONFIG.DRIFT_THRESHOLD_SEEK) {
      newSyncStatus = 'seeking';
      video.currentTime = expectedPosition;
      smoothedDrift.current = 0; // Reset smoothed drift after seek
      newPlaybackRate = 1;
    } 
    // Progressive rubber-banding for smaller drift
    else if (Math.abs(currentDrift) > SYNC_CONFIG.DRIFT_THRESHOLD_ADJUST) {
      // Calculate proportional rate adjustment based on drift magnitude
      // Larger drift = faster correction, capped at MAX_SPEEDUP/MAX_SLOWDOWN
      const driftMagnitude = Math.abs(currentDrift);
      const correctionFactor = Math.min(driftMagnitude * 0.1, 0.08); // Max 8% adjustment
      
      if (currentDrift > 0) {
        // Behind server - speed up
        newSyncStatus = 'behind';
        newPlaybackRate = Math.min(1 + correctionFactor, SYNC_CONFIG.MAX_SPEEDUP);
      } else {
        // Ahead of server - slow down
        newSyncStatus = 'ahead';
        newPlaybackRate = Math.max(1 - correctionFactor, SYNC_CONFIG.MAX_SLOWDOWN);
      }
    }
    // Within sync threshold
    else if (Math.abs(currentDrift) < SYNC_CONFIG.DRIFT_THRESHOLD_SYNCED) {
      newSyncStatus = 'synced';
      newPlaybackRate = 1;
    }

    // Apply playback rate change only if different (avoid unnecessary updates)
    if (Math.abs(video.playbackRate - newPlaybackRate) > 0.001) {
      video.playbackRate = newPlaybackRate;
    }

    // Sync play/pause state
    if (videoState.isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!videoState.isPlaying && !video.paused) {
      video.pause();
    }

    setSyncStatus(newSyncStatus);
    setDrift(currentDrift);
    setPlaybackRate(newPlaybackRate);
  }, [videoState, isBuffering, networkLatency]);

  // ═══════════════════════════════════════════════════════════════════
  // HIGH-FREQUENCY SYNC LOOP using requestAnimationFrame + interval hybrid
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    let lastFrameTime = 0;
    
    const syncLoop = (timestamp: number) => {
      // Throttle to SYNC_INTERVAL (default 100ms)
      if (timestamp - lastFrameTime >= SYNC_CONFIG.SYNC_INTERVAL) {
        syncVideoPlayback();
        lastFrameTime = timestamp;
      }
      animationFrameRef.current = requestAnimationFrame(syncLoop);
    };

    animationFrameRef.current = requestAnimationFrame(syncLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [syncVideoPlayback]);

  // ═══════════════════════════════════════════════════════════════════
  // USER CONTROLS - Optimistic updates + cooldown to prevent sync fighting
  // ═══════════════════════════════════════════════════════════════════
  
  // Send play command with optimistic update
  const play = useCallback(() => {
    const video = videoRef.current;
    lastUserAction.current = Date.now(); // Start cooldown
    
    if (video) {
      // Optimistic: immediately play locally
      video.play().catch(() => {});
      video.playbackRate = 1; // Reset rate on user action
      // Update local state immediately for instant UI feedback
      setVideoState(prev => ({
        ...prev,
        isPlaying: true,
        currentTime: video.currentTime,
        serverTimestamp: Date.now(),
      }));
      setPlaybackRate(1);
      smoothedDrift.current = 0; // Reset drift tracking
    }
    // Notify server for other clients
    socket?.emit('video:play');
  }, [socket]);

  // Send pause command with optimistic update
  const pause = useCallback(() => {
    const video = videoRef.current;
    lastUserAction.current = Date.now(); // Start cooldown
    
    if (video) {
      // Optimistic: immediately pause locally
      video.pause();
      video.playbackRate = 1; // Reset rate on user action
      // Update local state immediately for instant UI feedback
      setVideoState(prev => ({
        ...prev,
        isPlaying: false,
        currentTime: video.currentTime,
        serverTimestamp: Date.now(),
      }));
      setPlaybackRate(1);
      smoothedDrift.current = 0; // Reset drift tracking
    }
    // Notify server for other clients
    socket?.emit('video:pause');
  }, [socket]);

  // Send seek command with optimistic update
  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    lastUserAction.current = Date.now(); // Start cooldown
    
    if (video) {
      // Optimistic: immediately seek locally
      video.currentTime = time;
      video.playbackRate = 1; // Reset rate on user action
      // Update local state immediately
      setVideoState(prev => ({
        ...prev,
        currentTime: time,
        serverTimestamp: Date.now(),
      }));
      setPlaybackRate(1);
      smoothedDrift.current = 0; // Reset drift tracking
    }
    // Notify server for other clients
    socket?.emit('video:seek', time);
  }, [socket]);

  // Send cursor position
  const updateCursor = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastCursorUpdate.current < 50) return;
    lastCursorUpdate.current = now;

    if (socket && currentUser) {
      socket.emit('cursor:move', { x, y });
    }
  }, [socket, currentUser]);

  // Send reaction
  const sendReaction = useCallback((emoji: string, x: number, y: number) => {
    if (socket && videoRef.current) {
      socket.emit('reaction:send', {
        emoji,
        x,
        y,
        videoTime: videoRef.current.currentTime,
      });
    }
  }, [socket]);

  return {
    isConnected,
    videoState,
    cursors,
    reactions,
    currentUser: currentUser ? { id: currentUser.id, city: currentUser.city, flag: currentUser.flag } : null,
    users,
    syncStatus,
    drift,
    playbackRate,
    isBuffering,
    networkLatency,
    setVideoRef,
    play,
    pause,
    seek,
    updateCursor,
    sendReaction,
  };
}
