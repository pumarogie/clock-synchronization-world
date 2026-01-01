'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface DriftSimulatorProps {
  actualOffset: number;
  syncedTime: number;
}

export function DriftSimulator({ actualOffset, syncedTime }: DriftSimulatorProps) {
  const [simulatedDrift, setSimulatedDrift] = useState(0);
  const [showComparison, setShowComparison] = useState(true);

  // Local time (potentially drifted)
  const localTime = new Date(Date.now() + simulatedDrift);
  // Server-synced time
  const serverTime = new Date(syncedTime);
  // Corrected time (local + offset)
  const correctedTime = new Date(Date.now() + simulatedDrift + actualOffset);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 1
    });
  };

  const presetDrifts = [
    { label: 'No Drift', value: 0 },
    { label: '+1 second', value: 1000 },
    { label: '+5 seconds', value: 5000 },
    { label: '+30 seconds', value: 30000 },
    { label: '-1 second', value: -1000 },
    { label: '-5 seconds', value: -5000 },
  ];

  return (
    <div className="p-6 rounded-2xl bg-linear-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl border border-slate-600/30">
      <h2 className="text-xl font-semibold text-white flex items-center gap-3 mb-2">
        <span className="text-2xl">🎮</span>
        Clock Drift Simulator
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        Simulate what happens when your device clock is wrong
      </p>

      {/* Drift slider */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-slate-300">Simulated Clock Drift</label>
          <span className="text-sm font-mono text-cyan-400">
            {simulatedDrift >= 0 ? '+' : ''}{(simulatedDrift / 1000).toFixed(1)}s
          </span>
        </div>
        <input
          type="range"
          min="-60000"
          max="60000"
          step="100"
          value={simulatedDrift}
          onChange={(e) => setSimulatedDrift(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>-60s (behind)</span>
          <span>0 (accurate)</span>
          <span>+60s (ahead)</span>
        </div>
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {presetDrifts.map((preset) => (
          <button
            key={preset.value}
            onClick={() => setSimulatedDrift(preset.value)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
              simulatedDrift === preset.value
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Toggle comparison view */}
      <button
        onClick={() => setShowComparison(!showComparison)}
        className="mb-6 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        {showComparison ? '▼ Hide' : '▶ Show'} Time Comparison
      </button>

      {/* Time comparison */}
      {showComparison && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
        >
          {/* Your "drifted" clock */}
          <TimeDisplay
            label="Your Device Clock"
            sublabel="(with simulated drift)"
            time={formatTime(localTime)}
            color="red"
            icon="⏰"
            drift={simulatedDrift !== 0 ? `${simulatedDrift >= 0 ? '+' : ''}${(simulatedDrift/1000).toFixed(1)}s drift` : 'Accurate'}
          />

          {/* Server reference time */}
          <TimeDisplay
            label="Server Time"
            sublabel="(source of truth)"
            time={formatTime(serverTime)}
            color="green"
            icon="🖥️"
            drift="Reference"
          />

          {/* Corrected time */}
          <TimeDisplay
            label="Corrected Time"
            sublabel="(after sync)"
            time={formatTime(correctedTime)}
            color="cyan"
            icon="✓"
            drift={`Offset applied: ${actualOffset >= 0 ? '+' : ''}${actualOffset.toFixed(1)}ms`}
          />
        </motion.div>
      )}

      {/* Visual difference indicator */}
      <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/50">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <span>📏</span>
          Time Difference Analysis
        </h3>

        <div className="space-y-3">
          <DifferenceBar
            label="Device vs Server"
            difference={simulatedDrift}
            maxDiff={60000}
            description={getDifferenceDescription(simulatedDrift)}
          />
          
          <DifferenceBar
            label="After Sync Correction"
            difference={simulatedDrift + actualOffset}
            maxDiff={60000}
            description={getCorrectionDescription(simulatedDrift, actualOffset)}
            isCorrected
          />
        </div>
      </div>

      {/* Educational note */}
      <div className="mt-6 p-4 rounded-xl bg-linear-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <span>⚠️</span>
          Real-World Implications
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          Even small clock drift causes big problems: <span className="text-orange-400">SSL certificates fail</span> if 
          your clock is off by minutes, <span className="text-orange-400">database conflicts</span> happen when 
          timestamps don&apos;t match, and <span className="text-orange-400">distributed systems break</span> when 
          nodes disagree on time. This is why services like NTP and protocols like this demo uses 
          are essential for the internet to function.
        </p>
      </div>
    </div>
  );
}

function TimeDisplay({
  label,
  sublabel,
  time,
  color,
  icon,
  drift,
}: {
  label: string;
  sublabel: string;
  time: string;
  color: 'red' | 'green' | 'cyan';
  icon: string;
  drift: string;
}) {
  const colors = {
    red: 'border-red-500/30 bg-red-500/5',
    green: 'border-green-500/30 bg-green-500/5',
    cyan: 'border-cyan-500/30 bg-cyan-500/5',
  };

  const textColors = {
    red: 'text-red-400',
    green: 'text-green-400',
    cyan: 'text-cyan-400',
  };

  return (
    <motion.div
      className={`p-4 rounded-xl border ${colors[color]}`}
      initial={{ scale: 0.95 }}
      animate={{ scale: 1 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <div>
          <div className="text-sm font-medium text-white">{label}</div>
          <div className="text-xs text-slate-500">{sublabel}</div>
        </div>
      </div>
      <div className={`font-mono text-2xl font-bold ${textColors[color]} mb-1`}>
        {time}
      </div>
      <div className="text-xs text-slate-500">{drift}</div>
    </motion.div>
  );
}

function DifferenceBar({
  label,
  difference,
  maxDiff,
  description,
  isCorrected = false,
}: {
  label: string;
  difference: number;
  maxDiff: number;
  description: string;
  isCorrected?: boolean;
}) {
  const percentage = Math.min(Math.abs(difference) / maxDiff * 100, 100);
  const isAhead = difference > 0;
  const isAccurate = Math.abs(difference) < 100;

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className={`text-xs font-mono ${
          isAccurate ? 'text-emerald-400' : isAhead ? 'text-orange-400' : 'text-blue-400'
        }`}>
          {isAccurate ? '~0ms' : `${isAhead ? '+' : ''}${(difference / 1000).toFixed(2)}s`}
        </span>
      </div>
      <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden relative">
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-500 z-10" />
        
        {/* Difference bar */}
        <motion.div
          className={`absolute top-0 bottom-0 rounded-full ${
            isAccurate
              ? 'bg-emerald-500'
              : isCorrected
                ? 'bg-cyan-500'
                : isAhead
                  ? 'bg-orange-500'
                  : 'bg-blue-500'
          }`}
          style={{
            left: isAhead ? '50%' : `${50 - percentage / 2}%`,
            width: `${percentage / 2}%`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage / 2}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div className="text-xs text-slate-500 mt-1">{description}</div>
    </div>
  );
}

function getDifferenceDescription(drift: number): string {
  const absDrift = Math.abs(drift);
  if (absDrift < 100) return 'Your clock is accurate';
  if (absDrift < 1000) return 'Slight drift - usually not noticeable';
  if (absDrift < 5000) return 'Noticeable drift - may affect timestamps';
  if (absDrift < 30000) return 'Significant drift - will cause issues';
  return 'Severe drift - many services will fail';
}

function getCorrectionDescription(drift: number, offset: number): string {
  const corrected = Math.abs(drift + offset);
  if (corrected < 100) return 'Fully corrected by sync!';
  if (corrected < 500) return 'Well within acceptable range';
  return 'Residual error after correction';
}

