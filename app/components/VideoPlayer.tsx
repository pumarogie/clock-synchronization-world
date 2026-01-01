"use client";

import { useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

interface VideoPlayerProps {
  setVideoRef: (video: HTMLVideoElement | null) => void;
  isPlaying: boolean;
  currentTime: number;
  syncStatus: "synced" | "ahead" | "behind" | "seeking" | "buffering";
  drift: number;
  playbackRate: number;
  isBuffering: boolean;
  networkLatency: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onMouseMove: (x: number, y: number) => void;
  onReaction: (emoji: string, x: number, y: number) => void;
}

const VIDEO_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

export function VideoPlayer({
  setVideoRef,
  isPlaying,
  currentTime,
  syncStatus,
  drift,
  playbackRate,
  isBuffering,
  networkLatency,
  onPlay,
  onPause,
  onSeek,
  onMouseMove,
  onReaction,
}: VideoPlayerProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Pass video ref to parent
  useEffect(() => {
    setVideoRef(videoElementRef.current);
    return () => setVideoRef(null);
  }, [setVideoRef]);

  // Handle mouse move for cursor tracking
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!videoContainerRef.current) return;
      const rect = videoContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      onMouseMove(x, y);
    },
    [onMouseMove],
  );

  // Handle click for reactions
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!videoContainerRef.current) return;
      const rect = videoContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      // Random reaction emoji
      const emojis = ["❤️", "🔥", "😂", "😮", "👏", "🎉", "💯", "✨"];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      onReaction(emoji, x, y);
    },
    [onReaction],
  );

  // Handle seek from progress bar
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !videoElementRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      const newTime = clickPosition * (videoElementRef.current.duration || 0);
      onSeek(newTime);
    },
    [onSeek],
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const syncStatusConfig = {
    synced: {
      color: "text-emerald-400",
      bg: "bg-emerald-500/20",
      label: "Synced",
      icon: "✓",
    },
    ahead: {
      color: "text-blue-400",
      bg: "bg-blue-500/20",
      label: "Ahead",
      icon: "⏪",
    },
    behind: {
      color: "text-orange-400",
      bg: "bg-orange-500/20",
      label: "Behind",
      icon: "⏩",
    },
    seeking: {
      color: "text-purple-400",
      bg: "bg-purple-500/20",
      label: "Seeking",
      icon: "⟳",
    },
    buffering: {
      color: "text-yellow-400",
      bg: "bg-yellow-500/20",
      label: "Buffering",
      icon: "◌",
    },
  };

  const statusConfig = syncStatusConfig[syncStatus];

  return (
    <div className="relative">
      {/* Video Container */}
      <div
        ref={videoContainerRef}
        className="relative aspect-video bg-black rounded-xl overflow-hidden cursor-none group"
        onMouseMove={handleMouseMove}
        onDoubleClick={handleDoubleClick}
      >
        {/* Video Element */}
        <video
          ref={videoElementRef}
          className="w-full h-full object-contain"
          src={VIDEO_URL}
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          muted
        />

        {/* Buffering Overlay */}
        {isBuffering && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center gap-3">
              <motion.div
                className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span className="text-purple-400 text-sm font-medium">
                Buffering...
              </span>
            </div>
          </motion.div>
        )}

        {/* Unmute hint */}
        <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs">
          🔇 Video is muted (browser autoplay policy)
        </div>

        {/* Network Latency Badge */}
        <div className="absolute bottom-4 right-4 px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700/50 text-xs text-slate-400">
          RTT: {(networkLatency * 2).toFixed(0)}ms
        </div>

        {/* Sync Status Overlay */}
        <motion.div
          className={`absolute top-4 right-4 px-3 py-1.5 rounded-full ${statusConfig.bg} border border-white/10 backdrop-blur-sm`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2">
            <motion.span
              animate={syncStatus === "seeking" ? { rotate: 360 } : {}}
              transition={{
                duration: 1,
                repeat: syncStatus === "seeking" ? Infinity : 0,
                ease: "linear",
              }}
            >
              {statusConfig.icon}
            </motion.span>
            <span className={`text-sm font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            {syncStatus !== "synced" && (
              <span className="text-xs text-slate-400">
                ({drift > 0 ? "+" : ""}
                {drift.toFixed(2)}s)
              </span>
            )}
          </div>
        </motion.div>

        {/* Playback Rate Indicator */}
        {playbackRate !== 1 && (
          <motion.div
            className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-slate-800/80 border border-white/10 backdrop-blur-sm"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="text-sm font-mono text-cyan-400">
              {playbackRate.toFixed(2)}x
            </span>
          </motion.div>
        )}

        {/* Double-click hint */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-sm text-white/70">
            Double-click to react
          </div>
        </div>

        {/* Center Play/Pause Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <motion.button
            onClick={isPlaying ? onPause : onPlay}
            className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            {isPlaying ? (
              <svg
                className="w-8 h-8 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg
                className="w-8 h-8 text-white ml-1"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </motion.button>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 space-y-3">
        {/* Progress Bar */}
        <div
          ref={progressRef}
          className="h-2 bg-slate-700 rounded-full cursor-pointer overflow-hidden"
          onClick={handleProgressClick}
        >
          <motion.div
            className="h-full bg-linear-to-r from-cyan-500 to-purple-500 rounded-full"
            style={{
              width: `${(currentTime / (videoElementRef.current?.duration || 1)) * 100}%`,
            }}
          />
        </div>

        {/* Time and Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button
              onClick={isPlaying ? onPause : onPlay}
              className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
              {isPlaying ? (
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Time Display */}
            <div className="font-mono text-sm text-slate-400">
              {formatTime(currentTime)} /{" "}
              {formatTime(videoElementRef.current?.duration || 0)}
            </div>
          </div>

          {/* Sync Info */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Drift:</span>
              <span
                className={
                  drift > 0.1 || drift < -0.1
                    ? "text-orange-400"
                    : "text-emerald-400"
                }
              >
                {drift > 0 ? "+" : ""}
                {(drift * 1000).toFixed(0)}ms
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Rate:</span>
              <span className="text-cyan-400 font-mono">
                {playbackRate.toFixed(2)}x
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
