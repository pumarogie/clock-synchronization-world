'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '../hooks/useSocket';

interface UserPresenceProps {
  users: User[];
  currentUser: User | null;
  isConnected: boolean;
  getSyncedTimeForTimezone: (timezone: string) => string;
}

export function UserPresence({ 
  users, 
  currentUser, 
  isConnected,
  getSyncedTimeForTimezone 
}: UserPresenceProps) {
  // Sort users to show current user first
  const sortedUsers = [...users].sort((a, b) => {
    if (a.id === currentUser?.id) return -1;
    if (b.id === currentUser?.id) return 1;
    return a.connectedAt - b.connectedAt;
  });

  return (
    <div className="w-full p-6 rounded-2xl bg-linear-to-br from-slate-900/60 to-slate-800/40 backdrop-blur-xl border border-slate-600/30">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-3">
          <span className="text-2xl">👥</span>
          Connected Users
        </h2>
        <div className="flex items-center gap-2">
          <motion.div
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`}
            animate={isConnected ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-sm text-slate-400">
            {isConnected ? `${users.length} online` : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Connection status message */}
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
        >
          WebSocket connection lost. Attempting to reconnect...
        </motion.div>
      )}

      {/* User list */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {sortedUsers.map((user) => {
            const isCurrentUser = user.id === currentUser?.id;
            const timeSinceLastSeen = Date.now() - user.lastSeen;
            const isActive = timeSinceLastSeen < 10000; // Active if seen in last 10 seconds

            return (
              <motion.div
                key={user.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                  isCurrentUser
                    ? 'bg-linear-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20'
                    : 'bg-slate-800/30 border border-slate-700/30 hover:border-slate-600/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar/Flag */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center text-xl">
                      {user.flag}
                    </div>
                    {/* Online indicator */}
                    <motion.div
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                        isActive ? 'bg-emerald-400' : 'bg-slate-500'
                      }`}
                      animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>

                  {/* User info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">
                        {user.city}
                      </span>
                      {isCurrentUser && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {user.timezone}
                    </div>
                  </div>
                </div>

                {/* User's local time */}
                <div className="text-right">
                  <div className="font-mono text-lg text-cyan-400">
                    {getSyncedTimeForTimezone(user.timezone)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {isActive ? 'Online' : formatLastSeen(timeSinceLastSeen)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {users.length === 0 && isConnected && (
          <div className="text-center py-8 text-slate-500">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="text-3xl mb-2"
            >
              ⟳
            </motion.div>
            <p>Connecting to other users...</p>
          </div>
        )}
      </div>

      {/* Educational note */}
      <div className="mt-6 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
        <h3 className="text-sm font-semibold text-purple-400 mb-2 flex items-center gap-2">
          <span>🔌</span>
          Real-time Presence
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          User presence is synchronized via <span className="text-white font-medium">WebSockets</span>. 
          Each connected user broadcasts their timezone, and all clients receive updates in real-time. 
          Open multiple browser tabs to see this in action!
        </p>
      </div>
    </div>
  );
}

function formatLastSeen(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

