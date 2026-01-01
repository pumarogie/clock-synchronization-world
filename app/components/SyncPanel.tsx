'use client';

import { motion } from 'framer-motion';
import type { SyncMeasurement } from '../hooks/useTimeSync';

interface SyncPanelProps {
  offset: number;
  roundTripTime: number;
  syncQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  isSyncing: boolean;
  lastSyncAt: number | null;
  syncHistory: SyncMeasurement[];
  onSync: () => void;
}

export function SyncPanel({
  offset,
  roundTripTime,
  syncQuality,
  isSyncing,
  lastSyncAt,
  syncHistory,
  onSync,
}: SyncPanelProps) {
  const qualityColors = {
    excellent: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
    good: 'text-green-400 bg-green-500/20 border-green-500/30',
    fair: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
    poor: 'text-red-400 bg-red-500/20 border-red-500/30',
    unknown: 'text-slate-400 bg-slate-500/20 border-slate-500/30',
  };

  const qualityLabels = {
    excellent: '< 50ms RTT',
    good: '< 100ms RTT',
    fair: '< 200ms RTT',
    poor: '> 200ms RTT',
    unknown: 'Not synced',
  };

  const lastMeasurement = syncHistory[syncHistory.length - 1];

  return (
    <div className="w-full p-6 rounded-2xl bg-linear-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl border border-slate-600/30">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          Time Synchronization
        </h2>
        <motion.button
          onClick={onSync}
          disabled={isSyncing}
          className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 
                     hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200 text-sm font-medium"
          whileTap={{ scale: 0.95 }}
        >
          {isSyncing ? (
            <span className="flex items-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                ⟳
              </motion.span>
              Syncing...
            </span>
          ) : (
            'Sync Now'
          )}
        </motion.button>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Clock Offset"
          value={`${offset >= 0 ? '+' : ''}${offset.toFixed(1)}ms`}
          description="Difference from server"
          accent={offset > 100 || offset < -100 ? 'text-yellow-400' : 'text-cyan-400'}
        />
        <StatCard
          label="Round Trip"
          value={`${roundTripTime.toFixed(1)}ms`}
          description="Network latency"
          accent="text-purple-400"
        />
        <StatCard
          label="Sync Quality"
          value={syncQuality.charAt(0).toUpperCase() + syncQuality.slice(1)}
          description={qualityLabels[syncQuality]}
          accent={qualityColors[syncQuality].split(' ')[0]}
        />
        <StatCard
          label="Last Sync"
          value={lastSyncAt ? formatTimeAgo(lastSyncAt) : 'Never'}
          description={lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'Waiting...'}
          accent="text-slate-400"
        />
      </div>

      {/* NTP Algorithm Breakdown */}
      <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 mb-6">
        <h3 className="text-sm font-semibold text-cyan-400 mb-4 flex items-center gap-2">
          <span>🔬</span>
          NTP-Style Offset Calculation
        </h3>
        
        {lastMeasurement ? (
          <div className="space-y-3 font-mono text-sm">
            <div className="grid grid-cols-2 gap-4">
              <TimeStampRow 
                label="T1 (Client Send)" 
                value={lastMeasurement.t1} 
                color="text-blue-400"
              />
              <TimeStampRow 
                label="T2 (Server Receive)" 
                value={lastMeasurement.t2} 
                color="text-green-400"
              />
              <TimeStampRow 
                label="T3 (Server Send)" 
                value={lastMeasurement.t3} 
                color="text-yellow-400"
              />
              <TimeStampRow 
                label="T4 (Client Receive)" 
                value={lastMeasurement.t4} 
                color="text-purple-400"
              />
            </div>

            <div className="pt-3 border-t border-slate-700/50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Offset = ((T2-T1) + (T3-T4)) / 2</span>
                <span className="text-cyan-400">{lastMeasurement.offset.toFixed(2)}ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">RTT = (T4-T1) - (T3-T2)</span>
                <span className="text-purple-400">{lastMeasurement.roundTripTime.toFixed(2)}ms</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">
            Waiting for first sync measurement...
          </p>
        )}
      </div>

      {/* Sync History Visualization */}
      {syncHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-400">Sync History (Last {syncHistory.length})</h3>
          <div className="flex items-end gap-1 h-16">
            {syncHistory.map((measurement, i) => {
              const maxRtt = Math.max(...syncHistory.map(m => m.roundTripTime));
              const height = (measurement.roundTripTime / maxRtt) * 100;
              
              return (
                <motion.div
                  key={`sync-${i}-${measurement.timestamp}`}
                  className="flex-1 bg-linear-to-t from-cyan-500/40 to-cyan-400/60 rounded-t"
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  title={`RTT: ${measurement.roundTripTime.toFixed(1)}ms`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Older</span>
            <span>RTT History</span>
            <span>Newer</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  description, 
  accent 
}: { 
  label: string; 
  value: string; 
  description: string; 
  accent: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${accent}`}>{value}</div>
      <div className="text-xs text-slate-600 mt-1">{description}</div>
    </div>
  );
}

function TimeStampRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`${color} text-xs`}>{value}</span>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

