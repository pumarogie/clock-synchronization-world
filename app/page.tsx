"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { WorldClocks } from "./components/WorldClocks";
import { SyncPanel } from "./components/SyncPanel";
import { UserPresence } from "./components/UserPresence";
import { SyncTimeline } from "./components/SyncTimeline";
import { DriftSimulator } from "./components/DriftSimulator";
import { LearnSection } from "./components/LearnSection";
import { WatchParty } from "./components/WatchParty";
import { useTimeSync } from "./hooks/useTimeSync";
import { useSocket } from "./hooks/useSocket";

type TabId = "dashboard" | "watch-party" | "visualize" | "simulate" | "learn";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "🌍" },
  { id: "watch-party", label: "Watch Party", icon: "🎬" },
  { id: "visualize", label: "Visualize", icon: "📊" },
  { id: "simulate", label: "Simulate", icon: "🎮" },
  { id: "learn", label: "Learn", icon: "📚" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const timeSync = useTimeSync({ syncInterval: 10000 });
  const socket = useSocket();

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Gradient orbs */}
        <motion.div
          className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, -50, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Main content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.header
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm mb-4"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            >
              ⏱️
            </motion.span>
            Interactive Educational Demo
          </motion.div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-3 bg-linear-to-br from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
            Clock Synchronization
          </h1>
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
            Understand how distributed systems keep time in sync using
            <span className="text-cyan-400 font-medium">
              {" "}
              NTP-style algorithms
            </span>{" "}
            and
            <span className="text-purple-400 font-medium">
              {" "}
              real-time WebSockets
            </span>
          </p>
        </motion.header>

        {/* Tab Navigation */}
        <motion.nav
          className="flex justify-center mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="inline-flex bg-slate-800/50 rounded-xl p-1 border border-slate-700/50">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-cyan-500/20 border border-cyan-500/30 rounded-lg"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <span>{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            ))}
          </div>
        </motion.nav>

        {/* Status bar */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-3 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <StatusBadge
            label="Sync"
            value={timeSync.syncQuality !== "unknown" ? "OK" : "..."}
            status={timeSync.syncQuality !== "unknown" ? "success" : "pending"}
          />
          <StatusBadge
            label="WebSocket"
            value={socket.isConnected ? "Live" : "Off"}
            status={socket.isConnected ? "success" : "error"}
          />
          <StatusBadge
            label="Users"
            value={`${socket.users.length}`}
            status="info"
          />
          <StatusBadge
            label="Offset"
            value={`${timeSync.offset >= 0 ? "+" : ""}${timeSync.offset.toFixed(0)}ms`}
            status={Math.abs(timeSync.offset) < 100 ? "success" : "warning"}
          />
          <StatusBadge
            label="RTT"
            value={`${timeSync.roundTripTime.toFixed(0)}ms`}
            status={timeSync.roundTripTime < 100 ? "success" : "warning"}
          />
        </motion.div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "dashboard" && (
            <div className="space-y-8">
              {/* World Clocks Section */}
              <WorldClocks
                getSyncedTimeForTimezone={timeSync.getSyncedTimeForTimezone}
                getSyncedDateForTimezone={timeSync.getSyncedDateForTimezone}
                localTimezone={socket.currentUser?.timezone}
              />

              {/* Two column layout for sync panel and presence */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <SyncPanel
                  offset={timeSync.offset}
                  roundTripTime={timeSync.roundTripTime}
                  syncQuality={timeSync.syncQuality}
                  isSyncing={timeSync.isSyncing}
                  lastSyncAt={timeSync.lastSyncAt}
                  syncHistory={timeSync.syncHistory}
                  onSync={timeSync.sync}
                />
                <UserPresence
                  users={socket.users}
                  currentUser={socket.currentUser}
                  isConnected={socket.isConnected}
                  getSyncedTimeForTimezone={timeSync.getSyncedTimeForTimezone}
                />
              </div>
            </div>
          )}

          {activeTab === "watch-party" && <WatchParty />}

          {activeTab === "visualize" && (
            <SyncTimeline
              lastMeasurement={
                timeSync.syncHistory[timeSync.syncHistory.length - 1] || null
              }
            />
          )}

          {activeTab === "simulate" && (
            <DriftSimulator
              actualOffset={timeSync.offset}
              syncedTime={timeSync.syncedTime}
            />
          )}

          {activeTab === "learn" && <LearnSection />}
        </motion.div>

        {/* Footer */}
        <motion.footer
          className="mt-12 text-center text-sm text-slate-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p className="mb-3">
            Open multiple browser tabs to see real-time multi-user
            synchronization
          </p>
          <div className="flex items-center justify-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              Server-synced time
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              WebSocket presence
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Your timezone
            </span>
          </div>
        </motion.footer>
      </main>
    </div>
  );
}

function StatusBadge({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "success" | "error" | "warning" | "pending" | "info";
}) {
  const colors = {
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    error: "bg-red-500/10 border-red-500/30 text-red-400",
    warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    pending: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    info: "bg-purple-500/10 border-purple-500/30 text-purple-400",
  };

  const dots = {
    success: "bg-emerald-400",
    error: "bg-red-400",
    warning: "bg-yellow-400",
    pending: "bg-blue-400",
    info: "bg-purple-400",
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${colors[status]}`}
    >
      <motion.div
        className={`w-1.5 h-1.5 rounded-full ${dots[status]}`}
        animate={status === "pending" ? { opacity: [1, 0.3, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <span className="text-xs text-slate-400">{label}:</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}
