"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Reaction } from "../hooks/useVideoSync";

interface ReactionsProps {
  reactions: Reaction[];
}

export function Reactions({ reactions }: ReactionsProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            className="absolute text-4xl"
            style={{
              left: `${reaction.x}%`,
              top: `${reaction.y}%`,
            }}
            initial={{
              opacity: 1,
              scale: 0,
              y: 0,
            }}
            animate={{
              opacity: [1, 1, 0],
              scale: [0, 1.5, 1],
              y: -100,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 2.5,
              ease: "easeOut",
              opacity: { times: [0, 0.7, 1] },
              scale: { times: [0, 0.2, 1] },
            }}
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Emoji picker for manual reactions
interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const emojis = [
    "❤️",
    "🔥",
    "😂",
    "😮",
    "👏",
    "🎉",
    "💯",
    "✨",
    "😍",
    "🤯",
    "👀",
    "💀",
  ];

  return (
    <div className="flex flex-wrap gap-2 p-3 bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-700/50">
      {emojis.map((emoji) => (
        <motion.button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="w-10 h-10 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 flex items-center justify-center text-xl transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {emoji}
        </motion.button>
      ))}
    </div>
  );
}
