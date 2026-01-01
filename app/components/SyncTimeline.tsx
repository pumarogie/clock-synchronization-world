"use client";

import { motion } from "framer-motion";
import type { SyncMeasurement } from "../hooks/useTimeSync";

interface SyncTimelineProps {
  lastMeasurement: SyncMeasurement | null;
}

export function SyncTimeline({ lastMeasurement }: SyncTimelineProps) {
  if (!lastMeasurement) {
    return (
      <div className="p-6 rounded-2xl bg-linear-to-br from-slate-900/60 to-slate-800/40 backdrop-blur-xl border border-slate-600/30">
        <h2 className="text-xl font-semibold text-white flex items-center gap-3 mb-4">
          <span className="text-2xl">📊</span>
          Sync Timeline Visualization
        </h2>
        <div className="text-center py-12 text-slate-500">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="text-4xl mb-4"
          >
            ⏳
          </motion.div>
          <p>Waiting for first sync to visualize the timeline...</p>
        </div>
      </div>
    );
  }

  const { t1, t2, t3, t4, offset, roundTripTime } = lastMeasurement;

  // Calculate relative positions for visualization
  const totalTime = t4 - t1;
  const clientToServer = ((t2 - t1) / totalTime) * 100;
  const serverProcessing = ((t3 - t2) / totalTime) * 100;
  const serverToClient = ((t4 - t3) / totalTime) * 100;

  return (
    <div className="p-6 rounded-2xl bg-linear-to-br from-slate-900/60 to-slate-800/40 backdrop-blur-xl border border-slate-600/30">
      <h2 className="text-xl font-semibold text-white flex items-center gap-3 mb-6">
        <span className="text-2xl">📊</span>
        Sync Timeline Visualization
      </h2>

      {/* Visual Timeline */}
      <div className="relative mb-8">
        {/* Labels */}
        <div className="flex justify-between mb-2">
          <div className="text-sm font-medium text-blue-400">Your Browser</div>
          <div className="text-sm font-medium text-green-400">Server</div>
        </div>

        {/* Timeline container */}
        <div className="relative h-40 bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          {/* Client line */}
          <div className="absolute top-8 left-4 right-4 h-0.5 bg-blue-500/30" />

          {/* Server line */}
          <div className="absolute bottom-8 left-4 right-4 h-0.5 bg-green-500/30" />

          {/* T1 - Client sends request */}
          <motion.div
            className="absolute top-6 left-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0 }}
          >
            <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-blue-300" />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-blue-400 font-mono whitespace-nowrap">
              T1
            </div>
          </motion.div>

          {/* Arrow from T1 to T2 */}
          <motion.svg
            className="absolute top-8 left-6"
            width={`${clientToServer}%`}
            height="80"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <motion.line
              x1="0"
              y1="0"
              x2="100%"
              y2="100%"
              stroke="rgba(59, 130, 246, 0.5)"
              strokeWidth="2"
              strokeDasharray="5,5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            />
            <polygon
              points="100%,100% calc(100% - 8),calc(100% - 4) calc(100% - 4),calc(100% - 8)"
              fill="rgba(59, 130, 246, 0.5)"
            />
          </motion.svg>

          {/* T2 - Server receives */}
          <motion.div
            className="absolute bottom-6"
            style={{ left: `calc(4px + ${clientToServer}%)` }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-green-300" />
            <div className="absolute top-6 left-1/2 -translate-x-1/2 text-xs text-green-400 font-mono whitespace-nowrap">
              T2
            </div>
          </motion.div>

          {/* Server processing indicator */}
          <motion.div
            className="absolute bottom-6 h-1 bg-linear-to-br from-green-500 to-yellow-500 rounded"
            style={{
              left: `calc(12px + ${clientToServer}%)`,
              width: `${serverProcessing}%`,
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          />

          {/* T3 - Server sends response */}
          <motion.div
            className="absolute bottom-6"
            style={{
              left: `calc(4px + ${clientToServer + serverProcessing}%)`,
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="w-4 h-4 bg-yellow-500 rounded-full border-2 border-yellow-300" />
            <div className="absolute top-6 left-1/2 -translate-x-1/2 text-xs text-yellow-400 font-mono whitespace-nowrap">
              T3
            </div>
          </motion.div>

          {/* T4 - Client receives */}
          <motion.div
            className="absolute top-6 right-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.9 }}
          >
            <div className="w-4 h-4 bg-purple-500 rounded-full border-2 border-purple-300" />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-purple-400 font-mono whitespace-nowrap">
              T4
            </div>
          </motion.div>

          {/* Request label */}
          <div className="absolute top-16 left-1/4 text-xs text-slate-500 transform -rotate-12">
            Request →
          </div>

          {/* Response label */}
          <div className="absolute bottom-16 right-1/4 text-xs text-slate-500 transform rotate-12">
            ← Response
          </div>
        </div>
      </div>

      {/* Timestamp breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <TimestampCard
          label="T1"
          sublabel="Client Send"
          value={t1}
          color="blue"
        />
        <TimestampCard
          label="T2"
          sublabel="Server Receive"
          value={t2}
          color="green"
        />
        <TimestampCard
          label="T3"
          sublabel="Server Send"
          value={t3}
          color="yellow"
        />
        <TimestampCard
          label="T4"
          sublabel="Client Receive"
          value={t4}
          color="purple"
        />
      </div>

      {/* Calculations explained */}
      <div className="space-y-4 p-4 bg-slate-800/40 rounded-xl border border-slate-700/50">
        <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
          <span>🧮</span>
          Step-by-Step Calculation
        </h3>

        <div className="space-y-3 font-mono text-sm">
          <CalculationStep
            step={1}
            title="One-way delay (Client → Server)"
            formula="T2 - T1"
            values={`${t2} - ${t1}`}
            result={`${t2 - t1}ms`}
            description="Time for your request to reach the server"
          />

          <CalculationStep
            step={2}
            title="Server Processing Time"
            formula="T3 - T2"
            values={`${t3} - ${t2}`}
            result={`${t3 - t2}ms`}
            description="Time the server spent processing"
          />

          <CalculationStep
            step={3}
            title="One-way delay (Server → Client)"
            formula="T4 - T3"
            values={`${t4} - ${t3}`}
            result={`${t4 - t3}ms`}
            description="Time for server response to reach you"
          />

          <CalculationStep
            step={4}
            title="Round-Trip Time (RTT)"
            formula="(T4 - T1) - (T3 - T2)"
            values={`(${t4} - ${t1}) - (${t3} - ${t2})`}
            result={`${roundTripTime.toFixed(2)}ms`}
            description="Total network time (excluding server processing)"
            highlight
          />

          <CalculationStep
            step={5}
            title="Clock Offset"
            formula="((T2 - T1) + (T3 - T4)) / 2"
            values={`((${t2} - ${t1}) + (${t3} - ${t4})) / 2`}
            result={`${offset.toFixed(2)}ms`}
            description="Difference between your clock and server clock"
            highlight
          />
        </div>
      </div>

      {/* Educational callout */}
      <div className="mt-6 p-4 rounded-xl bg-linear-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <span>💡</span>
          Why This Formula?
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          The NTP algorithm assumes{" "}
          <span className="text-cyan-400">symmetric network delays</span> — that
          the request and response take roughly the same time. By measuring the
          round-trip and accounting for server processing, we can estimate the
          one-way delay and calculate how much your clock differs from the
          server. A <span className="text-emerald-400">positive offset</span>{" "}
          means your clock is behind;{" "}
          <span className="text-red-400">negative</span> means it&apos;s ahead.
        </p>
      </div>
    </div>
  );
}

function TimestampCard({
  label,
  sublabel,
  value,
  color,
}: {
  label: string;
  sublabel: string;
  value: number;
  color: "blue" | "green" | "yellow" | "purple";
}) {
  const colors = {
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    green: "bg-green-500/10 border-green-500/30 text-green-400",
    yellow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    purple: "bg-purple-500/10 border-purple-500/30 text-purple-400",
  };

  return (
    <div className={`p-3 rounded-lg border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-bold">{label}</span>
        <span className="text-xs text-slate-500">{sublabel}</span>
      </div>
      <div className="font-mono text-xs text-slate-300 truncate">{value}</div>
    </div>
  );
}

function CalculationStep({
  step,
  title,
  formula,
  values,
  result,
  description,
  highlight = false,
}: {
  step: number;
  title: string;
  formula: string;
  values: string;
  result: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <motion.div
      className={`p-3 rounded-lg ${highlight ? "bg-cyan-500/10 border border-cyan-500/20" : "bg-slate-700/30"}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: step * 0.1 }}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold">
          {step}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white mb-1">{title}</div>
          <div className="text-xs text-slate-500 mb-2">{description}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <code className="px-2 py-0.5 bg-slate-800 rounded text-cyan-300">
              {formula}
            </code>
            <span className="text-slate-600">=</span>
            <code className="px-2 py-0.5 bg-slate-800 rounded text-slate-400 truncate max-w-[150px]">
              {values}
            </code>
            <span className="text-slate-600">=</span>
            <code
              className={`px-2 py-0.5 rounded font-bold ${highlight ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-emerald-400"}`}
            >
              {result}
            </code>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
