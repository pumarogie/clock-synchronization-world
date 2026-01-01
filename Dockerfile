# ═══════════════════════════════════════════════════════════════════════════
# MULTI-STAGE DOCKERFILE FOR SCALABLE VIDEO SYNC
# ═══════════════════════════════════════════════════════════════════════════
#
# Build: docker build -t sync-server .
# Run:   docker run -p 3000:3000 -e REDIS_URL=redis://host:6379 sync-server
#
# ═══════════════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════════════
# STAGE 1: DEPENDENCIES
# ═══════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS deps

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install dependencies based on lock file present
RUN \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm i --frozen-lockfile; \
  elif [ -f package-lock.json ]; then \
    npm ci; \
  else \
    npm i; \
  fi

# ═══════════════════════════════════════════════════════════════════════════
# STAGE 2: BUILDER
# ═══════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Build the application
RUN npm run build

# ═══════════════════════════════════════════════════════════════════════════
# STAGE 3: RUNNER (Production)
# ═══════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy server and lib files (not part of Next.js standalone)
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/lib ./lib

# Set correct permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Environment variables (can be overridden at runtime)
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV REDIS_URL "redis://localhost:6379"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the server
CMD ["npx", "tsx", "server.ts"]

