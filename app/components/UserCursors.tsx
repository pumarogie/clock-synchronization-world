'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Cursor } from '../hooks/useVideoSync';

interface UserCursorsProps {
  cursors: Map<string, Cursor>;
  currentUserId: string | null;
}

// Generate consistent colors for users
function getUserColor(userId: string): string {
  const colors = [
    '#f43f5e', // rose
    '#ec4899', // pink
    '#a855f7', // purple
    '#6366f1', // indigo
    '#3b82f6', // blue
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#f59e0b', // amber
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export function UserCursors({ cursors, currentUserId }: UserCursorsProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {Array.from(cursors.entries()).map(([userId, cursor]) => {
          // Don't show own cursor
          if (userId === currentUserId) return null;
          
          const color = getUserColor(userId);
          const isStale = Date.now() - cursor.timestamp > 5000;
          
          if (isStale) return null;
          
          return (
            <motion.div
              key={userId}
              className="absolute"
              style={{
                left: `${cursor.x}%`,
                top: `${cursor.y}%`,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                x: '-50%',
                y: '-50%',
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ 
                type: 'spring', 
                stiffness: 300, 
                damping: 25,
                opacity: { duration: 0.2 }
              }}
            >
              {/* Cursor pointer */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.3))` }}
              >
                <path
                  d="M5.5 3.21V20.8c0 .45.54.67.86.35l4.86-4.86h7.58c.45 0 .67-.54.35-.86L6.35 2.64c-.31-.32-.85-.1-.85.57z"
                  fill={color}
                  stroke="white"
                  strokeWidth="1.5"
                />
              </svg>
              
              {/* User label */}
              <motion.div
                className="absolute left-6 top-4 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap"
                style={{ 
                  backgroundColor: color,
                  color: 'white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                {cursor.flag} {cursor.city}
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

