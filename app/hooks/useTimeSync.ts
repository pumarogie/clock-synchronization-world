'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TimeSyncState {
  // The calculated offset between client and server clocks (in ms)
  offset: number;
  // Round-trip time for the sync request
  roundTripTime: number;
  // Current synchronized time (client time + offset)
  syncedTime: number;
  // Whether we're currently syncing
  isSyncing: boolean;
  // Last sync timestamp
  lastSyncAt: number | null;
  // Sync quality indicator
  syncQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  // History of sync measurements for averaging
  syncHistory: SyncMeasurement[];
  // Error if any
  error: string | null;
}

export interface SyncMeasurement {
  timestamp: number;
  offset: number;
  roundTripTime: number;
  t1: number; // Client send time
  t2: number; // Server receive time
  t3: number; // Server send time
  t4: number; // Client receive time
}

interface UseTimeSyncOptions {
  // How often to sync (in ms)
  syncInterval?: number;
  // Number of measurements to keep for averaging
  historySize?: number;
  // Whether to start syncing immediately
  autoStart?: boolean;
}

export function useTimeSync(options: UseTimeSyncOptions = {}) {
  const {
    syncInterval = 10000, // Sync every 10 seconds
    historySize = 5,
    autoStart = true,
  } = options;

  const [state, setState] = useState<TimeSyncState>({
    offset: 0,
    roundTripTime: 0,
    syncedTime: Date.now(),
    isSyncing: false,
    lastSyncAt: null,
    syncQuality: 'unknown',
    syncHistory: [],
    error: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Calculate sync quality based on round-trip time
  const calculateSyncQuality = (rtt: number): TimeSyncState['syncQuality'] => {
    if (rtt < 50) return 'excellent';
    if (rtt < 100) return 'good';
    if (rtt < 200) return 'fair';
    return 'poor';
  };

  // Perform a single sync measurement using NTP-style algorithm
  const performSync = useCallback(async (): Promise<SyncMeasurement | null> => {
    try {
      // T1: Client sends request
      const t1 = Date.now();

      const response = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSendTime: t1 }),
      });

      // T4: Client receives response
      const t4 = Date.now();

      if (!response.ok) {
        throw new Error('Failed to sync with server');
      }

      const data = await response.json();
      
      // T2: Server receive time, T3: Server send time
      const t2 = data.serverReceiveTime;
      const t3 = data.serverSendTime;

      // NTP-style offset calculation
      // Offset = ((T2 - T1) + (T3 - T4)) / 2
      // This gives us the difference between client and server clocks
      const offset = ((t2 - t1) + (t3 - t4)) / 2;

      // Round-trip time = (T4 - T1) - (T3 - T2)
      // Total time minus server processing time
      const roundTripTime = (t4 - t1) - (t3 - t2);

      return {
        timestamp: Date.now(),
        offset,
        roundTripTime,
        t1,
        t2,
        t3,
        t4,
      };
    } catch (error) {
      console.error('Sync failed:', error);
      return null;
    }
  }, []);

  // Main sync function that updates state
  const sync = useCallback(async () => {
    setState(prev => ({ ...prev, isSyncing: true, error: null }));

    const measurement = await performSync();

    if (measurement) {
      setState(prev => {
        // Add new measurement to history
        const newHistory = [...prev.syncHistory, measurement].slice(-historySize);

        // Calculate average offset from recent measurements for stability
        const avgOffset = newHistory.reduce((sum, m) => sum + m.offset, 0) / newHistory.length;
        const avgRtt = newHistory.reduce((sum, m) => sum + m.roundTripTime, 0) / newHistory.length;

        return {
          ...prev,
          offset: avgOffset,
          roundTripTime: avgRtt,
          isSyncing: false,
          lastSyncAt: Date.now(),
          syncQuality: calculateSyncQuality(avgRtt),
          syncHistory: newHistory,
        };
      });
    } else {
      setState(prev => ({
        ...prev,
        isSyncing: false,
        error: 'Failed to sync with server',
      }));
    }
  }, [performSync, historySize]);

  // Update synced time continuously
  useEffect(() => {
    const updateTime = () => {
      setState(prev => ({
        ...prev,
        syncedTime: Date.now() + prev.offset,
      }));
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Auto-sync at interval
  useEffect(() => {
    if (!autoStart) return;

    // Initial sync
    sync();

    // Set up interval
    intervalRef.current = setInterval(sync, syncInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sync, syncInterval, autoStart]);

  // Get synchronized time for a specific timezone
  const getSyncedTimeForTimezone = useCallback((timezone: string) => {
    const syncedDate = new Date(state.syncedTime);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(syncedDate);
  }, [state.syncedTime]);

  // Get full date for a timezone
  const getSyncedDateForTimezone = useCallback((timezone: string) => {
    const syncedDate = new Date(state.syncedTime);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(syncedDate);
  }, [state.syncedTime]);

  return {
    ...state,
    sync,
    getSyncedTimeForTimezone,
    getSyncedDateForTimezone,
  };
}

