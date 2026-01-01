/**
 * PM2 Ecosystem Configuration
 *
 * Production deployment configuration for horizontal scaling.
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --env production
 *   pm2 scale sync-server +2   # Add 2 more instances
 *   pm2 reload sync-server     # Zero-downtime reload
 *   pm2 logs sync-server       # View logs
 *   pm2 monit                  # Real-time monitoring
 */

module.exports = {
  apps: [
    {
      // ═══════════════════════════════════════════════════════════════════
      // MAIN APPLICATION
      // ═══════════════════════════════════════════════════════════════════
      name: "sync-server",
      script: "npx",
      args: "tsx server.ts",

      // Cluster mode - use all available CPU cores
      instances: "max",
      exec_mode: "cluster",

      // Auto-restart settings
      autorestart: true,
      watch: false, // Disable in production
      max_memory_restart: "1G",

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Logging
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Environment variables
      env: {
        NODE_ENV: "development",
        PORT: 3000,
        REDIS_URL: "redis://localhost:6379",
      },

      env_staging: {
        NODE_ENV: "staging",
        PORT: 3000,
        REDIS_URL: "redis://redis:6379",
      },

      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        REDIS_URL: "redis://redis-cluster:6379",
      },

      // Instance variables (each instance gets unique ID)
      instance_var: "INSTANCE_ID",

      // Health checks
      exp_backoff_restart_delay: 100,

      // Source maps for better error traces
      source_map_support: true,
    },

    // ═══════════════════════════════════════════════════════════════════
    // OPTIONAL: METRICS EXPORTER (for Prometheus/Grafana)
    // ═══════════════════════════════════════════════════════════════════
    // Uncomment to enable metrics
    /*
    {
      name: 'metrics-exporter',
      script: 'pm2-prometheus-exporter',
      instances: 1,
      exec_mode: 'fork',
      env: {
        PORT: 9209,
      },
    },
    */
  ],

  // ═══════════════════════════════════════════════════════════════════
  // DEPLOYMENT CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  deploy: {
    production: {
      user: "deploy",
      host: ["server1.example.com", "server2.example.com"],
      ref: "origin/main",
      repo: "git@github.com:your-org/clock-synchronization-world.git",
      path: "/var/www/sync-server",
      "pre-deploy-local": "",
      "post-deploy":
        "npm ci && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "",
      env: {
        NODE_ENV: "production",
      },
    },

    staging: {
      user: "deploy",
      host: "staging.example.com",
      ref: "origin/develop",
      repo: "git@github.com:your-org/clock-synchronization-world.git",
      path: "/var/www/sync-server-staging",
      "post-deploy": "npm ci && pm2 reload ecosystem.config.js --env staging",
      env: {
        NODE_ENV: "staging",
      },
    },
  },
};
