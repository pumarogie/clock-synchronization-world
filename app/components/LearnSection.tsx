'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TOPICS = [
  {
    id: 'why-sync',
    icon: '❓',
    title: 'Why Synchronize Time?',
    content: `
      In distributed systems, accurate time is crucial for:
      
      • **Ordering Events**: Knowing which action happened first (database writes, financial transactions)
      • **Security**: SSL/TLS certificates, authentication tokens, and session management all rely on accurate time
      • **Coordination**: Scheduled tasks, cron jobs, and distributed locks need synchronized clocks
      • **Debugging**: Log timestamps must be consistent across servers to trace issues
      • **Consensus**: Protocols like Raft and Paxos use time for leader election
      
      Without synchronization, a server 5 seconds behind might process "old" data as "new", causing data corruption.
    `,
  },
  {
    id: 'ntp',
    icon: '🌐',
    title: 'What is NTP?',
    content: `
      **Network Time Protocol (NTP)** is one of the oldest internet protocols, created in 1985.
      
      • Uses a hierarchy of time sources (called "stratum")
      • Stratum 0: Atomic clocks, GPS receivers
      • Stratum 1: Directly connected to stratum 0
      • Stratum 2+: Each level adds small errors
      
      NTP can synchronize clocks to within **milliseconds** over the internet and **microseconds** on LANs.
      
      Your computer likely syncs with NTP servers automatically (time.apple.com, time.windows.com, pool.ntp.org).
    `,
  },
  {
    id: 'algorithm',
    icon: '🧮',
    title: 'The Sync Algorithm',
    content: `
      The algorithm this demo uses is simplified NTP:
      
      **Step 1**: Client records T1 (send time) and sends request
      **Step 2**: Server records T2 (receive time)
      **Step 3**: Server records T3 (response time) and sends response
      **Step 4**: Client records T4 (receive time)
      
      **Assumptions**:
      • Network delay is roughly symmetric (request ≈ response time)
      • Server clock is the "source of truth"
      
      **Offset Formula**: ((T2-T1) + (T3-T4)) / 2
      
      This averages the one-way delays to estimate the true time difference.
    `,
  },
  {
    id: 'challenges',
    icon: '⚡',
    title: 'Synchronization Challenges',
    content: `
      Perfect sync is impossible due to:
      
      • **Network Jitter**: Packet delays vary unpredictably
      • **Asymmetric Routes**: Request might take different path than response
      • **Processing Delays**: OS scheduling, garbage collection pauses
      • **Leap Seconds**: Earth's rotation isn't perfectly uniform
      • **Relativity**: At extreme precision, even gravity matters!
      
      Real NTP implementations use statistical filtering, outlier rejection, and gradual clock adjustment ("slewing") to handle these issues.
    `,
  },
  {
    id: 'alternatives',
    icon: '🔄',
    title: 'Modern Alternatives',
    content: `
      **PTP (Precision Time Protocol)**
      • Hardware-assisted timestamps
      • Nanosecond accuracy
      • Used in financial trading, telecom
      
      **Google TrueTime**
      • Returns time as an interval [earliest, latest]
      • Accounts for uncertainty explicitly
      • Powers Google Spanner database
      
      **Logical Clocks**
      • Lamport Clocks: Counter-based ordering
      • Vector Clocks: Track causality between nodes
      • Don't need physical time at all!
    `,
  },
  {
    id: 'websocket',
    icon: '🔌',
    title: 'WebSocket Presence',
    content: `
      This demo uses WebSockets for real-time features:
      
      **How It Works**:
      1. Client opens persistent connection to server
      2. Server maintains list of all connected clients
      3. When state changes, server broadcasts to everyone
      4. Much faster than polling HTTP endpoints
      
      **Use Cases**:
      • Chat applications
      • Live dashboards
      • Multiplayer games
      • Collaborative editing
      
      Socket.io adds reliability features like automatic reconnection and fallback to polling.
    `,
  },
];

export function LearnSection() {
  const [expandedTopic, setExpandedTopic] = useState<string | null>('why-sync');

  return (
    <div className="p-6 rounded-2xl bg-linear-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl border border-slate-600/30">
      <h2 className="text-xl font-semibold text-white flex items-center gap-3 mb-6">
        <span className="text-2xl">📚</span>
        Learn More
      </h2>

      <div className="space-y-2">
        {TOPICS.map((topic) => (
          <div key={topic.id} className="rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedTopic(expandedTopic === topic.id ? null : topic.id)}
              className={`w-full flex items-center gap-3 p-4 text-left transition-all ${
                expandedTopic === topic.id
                  ? 'bg-cyan-500/10 border-l-2 border-cyan-500'
                  : 'bg-slate-800/30 hover:bg-slate-800/50 border-l-2 border-transparent'
              }`}
            >
              <span className="text-xl shrink-0">{topic.icon}</span>
              <span className="font-medium text-white flex-1">{topic.title}</span>
              <motion.span
                animate={{ rotate: expandedTopic === topic.id ? 180 : 0 }}
                className="text-slate-400"
              >
                ▼
              </motion.span>
            </button>
            
            <AnimatePresence>
              {expandedTopic === topic.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-slate-800/20 border-l-2 border-cyan-500/30">
                    <div className="prose prose-sm prose-invert max-w-none">
                      <FormattedContent content={topic.content} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Quick reference */}
      <div className="mt-6 p-4 rounded-xl bg-linear-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <span>🔗</span>
          Further Reading
        </h3>
        <div className="flex flex-wrap gap-2">
          <ExternalLink href="https://en.wikipedia.org/wiki/Network_Time_Protocol" label="NTP Wikipedia" />
          <ExternalLink href="https://datatracker.ietf.org/doc/html/rfc5905" label="NTP RFC 5905" />
          <ExternalLink href="https://cloud.google.com/spanner/docs/true-time-external-consistency" label="Google TrueTime" />
          <ExternalLink href="https://lamport.azurewebsites.net/pubs/time-clocks.pdf" label="Lamport Clocks Paper" />
        </div>
      </div>
    </div>
  );
}

function FormattedContent({ content }: { content: string }) {
  const lines = content.trim().split('\n');
  
  return (
    <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        
        // Bold text
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          return (
            <div key={i} className="font-semibold text-white">
              {trimmed.slice(2, -2)}
            </div>
          );
        }
        
        // Bullet points
        if (trimmed.startsWith('•')) {
          const text = trimmed.slice(1).trim();
          // Handle inline bold
          const parts = text.split(/\*\*(.*?)\*\*/);
          return (
            <div key={i} className="flex gap-2 ml-2">
              <span className="text-cyan-500">•</span>
              <span>
                {parts.map((part, j) => 
                  j % 2 === 1 
                    ? <span key={j} className="font-medium text-white">{part}</span>
                    : <span key={j}>{part}</span>
                )}
              </span>
            </div>
          );
        }
        
        // Regular text with inline bold
        const parts = trimmed.split(/\*\*(.*?)\*\*/);
        return (
          <div key={i}>
            {parts.map((part, j) => 
              j % 2 === 1 
                ? <span key={j} className="font-medium text-white">{part}</span>
                : <span key={j}>{part}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-slate-800/50 
                 border border-slate-700/50 text-slate-300 hover:text-white hover:border-slate-600 
                 transition-all"
    >
      {label}
      <span className="text-slate-500">↗</span>
    </a>
  );
}

