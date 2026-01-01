# 🌍 Clock Synchronization World

A production-ready demonstration of **real-time clock synchronization** and **video watch party** functionality, showcasing techniques used by platforms like Twitch, Netflix Party, and Discord.

Built with Next.js 16, React 19, Socket.io, and Redis — scalable to **100,000+ concurrent users**.

![Demo](https://img.shields.io/badge/Demo-Live-brightgreen) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101) ![Redis](https://img.shields.io/badge/Redis-7-DC382D)

---

## ✨ Features

### Time Synchronization
- **NTP-style algorithm** with T1-T4 timestamp exchange
- **Clock offset calculation** with sub-millisecond precision
- **Exponential smoothing** for jitter reduction
- **Visual timeline** showing the synchronization process
- **Drift simulator** to understand clock correction

### Watch Party (Video Sync)
- **Server-authoritative playback** — single source of truth
- **Optimistic updates** — instant local feedback
- **Rubber-banding sync** — smooth catch-up without jarring jumps
- **Real-time cursors** — see where others are pointing
- **Emoji reactions** — react together in real-time
- **Buffering detection** — pause sync during loading

### Scaling Features
- **Redis pub/sub** — cross-server communication
- **Room-based sharding** — partition by video/stream
- **Rate limiting** — abuse prevention (20 cursors/s, 5 reactions/s)
- **Message batching** — reduced network overhead
- **Sticky sessions** — WebSocket connection persistence
- **Graceful shutdown** — zero-downtime deployments

---

## 🏗️ Architecture

### Single Server Mode (Development)
```
┌─────────────────────────────────────────┐
│              Next.js + Socket.io        │
│                                         │
│  ┌─────────┐    ┌─────────┐            │
│  │ Client  │◄──►│ Server  │            │
│  └─────────┘    └────┬────┘            │
│                      │                  │
│                 ┌────┴────┐            │
│                 │ In-Memory│            │
│                 │  State   │            │
│                 └─────────┘            │
└─────────────────────────────────────────┘
```

### Clustered Mode (Production)
```
                    ┌─────────────────┐
                    │     Nginx       │
                    │  Load Balancer  │
                    │  (sticky sess)  │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
    │ Server 1│         │ Server 2│         │ Server N│
    │ (Room A)│         │ (Room B)│         │ (Room C)│
    └────┬────┘         └────┬────┘         └────┬────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │     Redis       │
                    │   Pub/Sub +     │
                    │   State Store   │
                    └─────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm/pnpm/yarn
- Redis (optional, for scaling)
- Docker (optional, for containerized deployment)

### Development

```bash
# Clone the repository
git clone <repo-url>
cd clock-synchronization-world

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
open http://localhost:3000
```

### Production (Single Server)

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Production (Scaled with Docker)

```bash
# Start full stack (3 app replicas + Redis + Nginx)
docker compose up -d

# Scale to 10 instances
docker compose up -d --scale app=10

# View logs
docker compose logs -f app

# Stop
docker compose down
```

### Production (PM2 Cluster)

```bash
# Install PM2 globally
npm install -g pm2

# Start cluster (uses all CPU cores)
pm2 start ecosystem.config.js --env production

# Monitor
pm2 monit

# Scale
pm2 scale sync-server +2
```

---

## 📁 Project Structure

```
clock-synchronization-world/
├── app/
│   ├── api/
│   │   ├── health/          # Health check endpoint
│   │   └── time/            # Time sync API
│   ├── components/
│   │   ├── Clock.tsx        # Analog/digital clock
│   │   ├── DriftSimulator.tsx
│   │   ├── LearnSection.tsx
│   │   ├── Reactions.tsx    # Floating emoji reactions
│   │   ├── SyncPanel.tsx    # Sync status display
│   │   ├── SyncTimeline.tsx # NTP visualization
│   │   ├── UserCursors.tsx  # Real-time cursors
│   │   ├── UserPresence.tsx # Connected users list
│   │   ├── VideoPlayer.tsx  # Synced video player
│   │   ├── WatchParty.tsx   # Watch party container
│   │   └── WorldClocks.tsx  # Global clock grid
│   ├── context/
│   │   └── SocketContext.tsx # Shared socket connection
│   ├── hooks/
│   │   ├── useSocket.ts     # Socket.io hook
│   │   ├── useTimeSync.ts   # NTP sync algorithm
│   │   └── useVideoSync.ts  # Video sync logic
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
├── lib/
│   ├── rateLimiter.js       # Rate limiting
│   ├── redis.js             # Redis client
│   └── roomManager.js       # Room state management
├── server.mjs               # Custom server (Next.js + Socket.io)
├── ecosystem.config.js      # PM2 configuration
├── nginx.conf               # Nginx load balancer
├── nginx-docker.conf        # Docker nginx config
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | Server port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `INSTANCE_ID` | Auto-generated | Unique instance identifier |
| `HOSTNAME` | `localhost` | Server hostname |

### Sync Configuration

Edit `app/hooks/useVideoSync.ts`:

```typescript
const SYNC_CONFIG = {
  SYNC_INTERVAL: 100,           // Check sync every 100ms
  DRIFT_THRESHOLD_SEEK: 1.5,    // Hard seek if >1.5s drift
  DRIFT_THRESHOLD_ADJUST: 0.05, // Rubber-band at 50ms drift
  MAX_SPEEDUP: 1.08,            // Max 8% speedup
  MAX_SLOWDOWN: 0.92,           // Max 8% slowdown
  USER_ACTION_COOLDOWN: 500,    // Ignore sync 500ms after user action
};
```

### Rate Limits

Edit `lib/rateLimiter.js`:

```javascript
const LIMITS = {
  cursor: { max: 20, windowMs: 1000 },      // 20/second
  reaction: { max: 5, windowMs: 1000 },     // 5/second
  sync: { max: 10, windowMs: 1000 },        // 10/second
  videoControl: { max: 10, windowMs: 1000 }, // 10/second
};
```

---

## 📡 WebSocket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `roomId: string` | Join a watch party room |
| `room:leave` | — | Leave current room |
| `video:play` | — | Start video playback |
| `video:pause` | — | Pause video playback |
| `video:seek` | `time: number` | Seek to position |
| `cursor:move` | `{ x, y }` | Update cursor position |
| `reaction:send` | `{ emoji, x, y, videoTime }` | Send reaction |
| `time:sync` | `clientTimestamp` | Request time sync |
| `heartbeat` | — | Keep connection alive |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `user:self` | `User` | Your user data |
| `users:list` | `User[]` | All users in room |
| `room:joined` | `{ roomId, room, videoState, users }` | Room join confirmation |
| `video:state` | `VideoState` | Current video state |
| `cursors:batch` | `Cursor[]` | Batched cursor updates |
| `reactions:batch` | `Reaction[]` | Batched reactions |
| `server:time` | `timestamp` | Server time broadcast |
| `error:ratelimit` | `{ action, retryIn }` | Rate limit error |

---

## 🧮 Time Sync Algorithm

This project implements an **NTP-style synchronization algorithm**:

```
Client                          Server
  │                               │
  │─────── T1 (send) ───────────►│
  │                               │ T2 (receive)
  │                               │ T3 (respond)
  │◄────── T4 (receive) ─────────│
  │                               │

Offset = ((T2 - T1) + (T3 - T4)) / 2
RTT = (T4 - T1) - (T3 - T2)
```

**Why it works:**
- Assumes symmetric network delays
- Averages forward and return delays
- Excludes server processing time from RTT
- Multiple samples are averaged for stability

---

## 🎬 Video Sync Algorithm

Based on techniques used by **Teleparty** and **Discord**:

1. **Server is authoritative** — single source of truth for playback state
2. **Clients calculate expected position** using server time + elapsed time
3. **Drift detection** — compare expected vs actual position
4. **Correction strategy:**
   - `|drift| > 1.5s` → Hard seek to expected position
   - `|drift| > 50ms` → Rubber-band (speed up/slow down 5-8%)
   - `|drift| < 20ms` → Synced, normal playback

```typescript
// Simplified sync loop
const expectedPosition = serverTime + timeSinceUpdate + latencyCompensation;
const drift = expectedPosition - actualPosition;

if (Math.abs(drift) > 1.5) {
  video.currentTime = expectedPosition; // Hard seek
} else if (drift > 0.05) {
  video.playbackRate = 1.05; // Speed up to catch up
} else if (drift < -0.05) {
  video.playbackRate = 0.95; // Slow down
} else {
  video.playbackRate = 1.0; // Synced
}
```

---

## 📈 Scaling Guide

### Capacity Estimates

| Configuration | Concurrent Users | Infrastructure |
|---------------|------------------|----------------|
| Single server | ~10,000 | 1 Node.js process |
| PM2 cluster (4 cores) | ~40,000 | 4 processes + Redis |
| Docker (10 containers) | ~100,000 | 10 servers + Redis |
| Kubernetes + regional | ~1,000,000+ | Multi-region |

### Bottlenecks & Solutions

| Bottleneck | Solution |
|------------|----------|
| Single process limit | PM2 cluster / Docker replicas |
| Cross-server state | Redis pub/sub adapter |
| Broadcast overhead | Room-based sharding |
| Network latency | Regional edge servers |
| Message volume | Batching + rate limiting |

### Redis Sentinel (High Availability)

```yaml
# docker-compose.prod.yml
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    
  redis-sentinel:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
    depends_on:
      - redis-master
```

---

## 🧪 Testing

### Manual Testing

1. Open multiple browser tabs/windows
2. Each should show as a separate user
3. Play/pause video — all tabs should sync
4. Move cursor — should appear on other tabs
5. Send reactions — should appear everywhere

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load test (create artillery.yml first)
artillery run artillery.yml
```

Example `artillery.yml`:

```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 100
  engines:
    socketio-v3: {}

scenarios:
  - engine: socketio-v3
    flow:
      - emit:
          channel: "room:join"
          data: "test-room"
      - think: 5
      - emit:
          channel: "cursor:move"
          data: { x: 50, y: 50 }
```

---

## 🔒 Security Considerations

- **Rate limiting** — Prevents spam and DoS
- **Input validation** — All events are validated server-side
- **Non-root Docker** — Container runs as `nextjs` user
- **CORS configured** — Restrict origins in production
- **WebSocket auth** — Add JWT validation for production

### Adding Authentication

```typescript
// server.mjs - Add to connection handler
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const user = verifyJWT(token);
    socket.data.userId = user.id;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **NTP Protocol** — For the time synchronization algorithm
- **Teleparty** — Inspiration for video sync approach
- **Socket.io** — Excellent real-time communication library
- **Big Buck Bunny** — Sample video from Blender Foundation

---

<p align="center">
  Built with ❤️ for learning real-time synchronization
</p>
