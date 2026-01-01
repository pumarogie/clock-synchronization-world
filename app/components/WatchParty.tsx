'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoPlayer } from './VideoPlayer';
import { UserCursors } from './UserCursors';
import { Reactions, EmojiPicker } from './Reactions';
import { useVideoSync } from '../hooks/useVideoSync';

export function WatchParty() {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const videoSync = useVideoSync();

  const handleEmojiSelect = (emoji: string) => {
    // Send reaction at center of video
    videoSync.sendReaction(emoji, 50, 50);
    setShowEmojiPicker(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-3">
            <span className="text-2xl">🎬</span>
            Watch Party
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Synchronized video playback with real-time presence
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
            videoSync.isConnected 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <motion.div
              className={`w-2 h-2 rounded-full ${videoSync.isConnected ? 'bg-emerald-400' : 'bg-red-400'}`}
              animate={videoSync.isConnected ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-sm">
              {videoSync.isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm">
            {videoSync.users.length} watching
          </div>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900/50 border border-slate-700/50">
        {/* Video Player */}
        <div className="relative">
          <VideoPlayer
            setVideoRef={videoSync.setVideoRef}
            isPlaying={videoSync.videoState.isPlaying}
            currentTime={videoSync.videoState.currentTime}
            syncStatus={videoSync.syncStatus}
            drift={videoSync.drift}
            playbackRate={videoSync.playbackRate}
            isBuffering={videoSync.isBuffering}
            networkLatency={videoSync.networkLatency}
            onPlay={videoSync.play}
            onPause={videoSync.pause}
            onSeek={videoSync.seek}
            onMouseMove={videoSync.updateCursor}
            onReaction={videoSync.sendReaction}
          />
          
          {/* User Cursors Overlay */}
          <UserCursors
            cursors={videoSync.cursors}
            currentUserId={videoSync.currentUser?.id || null}
          />
          
          {/* Reactions Overlay */}
          <Reactions reactions={videoSync.reactions} />
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex items-start justify-between gap-6">
        {/* User List */}
        <div className="flex-1 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
            <span>👥</span>
            Watching Now
          </h3>
          <div className="flex flex-wrap gap-2">
            {videoSync.users.map((user) => (
              <motion.div
                key={user.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  user.id === videoSync.currentUser?.id
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-700/50 text-slate-300'
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <span>{user.flag}</span>
                <span>{user.city}</span>
                {user.id === videoSync.currentUser?.id && (
                  <span className="text-xs">(you)</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Reaction Button */}
        <div className="relative">
          <motion.button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-pink-400 hover:from-pink-500/30 hover:to-purple-500/30 transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-xl">✨</span>
            <span className="text-sm font-medium">React</span>
          </motion.button>
          
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                className="absolute bottom-full right-0 mb-2"
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
              >
                <EmojiPicker onSelect={handleEmojiSelect} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Educational Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <h3 className="text-sm font-semibold text-cyan-400 mb-2 flex items-center gap-2">
            <span>🔄</span>
            How Sync Works
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            The server broadcasts the authoritative playback position every 500ms. 
            Each client compares their local position and adjusts playback speed 
            (1.05x if behind, 0.95x if ahead) to smoothly catch up without jarring jumps.
          </p>
        </div>
        
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <h3 className="text-sm font-semibold text-purple-400 mb-2 flex items-center gap-2">
            <span>👆</span>
            Cursor & Reactions
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Cursor positions are broadcast via WebSocket at 20Hz (throttled to 50ms). 
            Reactions are timestamped to the video position so everyone sees them 
            at the same moment in the content.
          </p>
        </div>
      </div>

      {/* Sync Stats */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <span>📊</span>
          Live Sync Statistics
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatBox
            label="Sync Status"
            value={videoSync.syncStatus.charAt(0).toUpperCase() + videoSync.syncStatus.slice(1)}
            color={videoSync.syncStatus === 'synced' ? 'emerald' : videoSync.syncStatus === 'buffering' ? 'purple' : 'orange'}
          />
          <StatBox
            label="Drift"
            value={`${(videoSync.drift * 1000).toFixed(0)}ms`}
            color={Math.abs(videoSync.drift) < 0.05 ? 'emerald' : Math.abs(videoSync.drift) < 0.1 ? 'cyan' : 'orange'}
          />
          <StatBox
            label="Playback Rate"
            value={`${videoSync.playbackRate.toFixed(2)}x`}
            color={videoSync.playbackRate === 1 ? 'emerald' : 'cyan'}
          />
          <StatBox
            label="Network RTT"
            value={`${(videoSync.networkLatency * 2).toFixed(0)}ms`}
            color={videoSync.networkLatency < 50 ? 'emerald' : videoSync.networkLatency < 100 ? 'cyan' : 'orange'}
          />
          <StatBox
            label="Buffering"
            value={videoSync.isBuffering ? 'Yes' : 'No'}
            color={videoSync.isBuffering ? 'purple' : 'emerald'}
          />
          <StatBox
            label="Server Time"
            value={new Date(videoSync.videoState.serverTimestamp).toLocaleTimeString()}
            color="slate"
          />
        </div>
      </div>
    </div>
  );
}

function StatBox({ 
  label, 
  value, 
  color 
}: { 
  label: string; 
  value: string; 
  color: 'emerald' | 'orange' | 'cyan' | 'slate' | 'purple';
}) {
  const colors = {
    emerald: 'text-emerald-400',
    orange: 'text-orange-400',
    cyan: 'text-cyan-400',
    slate: 'text-slate-400',
    purple: 'text-purple-400',
  };

  return (
    <div className="text-center">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`font-mono font-medium ${colors[color]}`}>{value}</div>
    </div>
  );
}

