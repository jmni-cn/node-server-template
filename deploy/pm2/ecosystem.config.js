// ============================================================
// PM2 ecosystem — runs the three built apps from dist/.
//
// Build first:   npm run build
// Start:         pm2 start deploy/pm2/ecosystem.config.js
// Reload:        pm2 reload ecosystem.config.js --update-env
//
// `cwd` is the repo root (one level up from this file's deploy/pm2 dir) so the
// relative `dist/apps/<app>/main` script paths resolve. Real secrets/connection
// values come from the host environment, not from this file.
// ============================================================
const path = require('path');

const cwd = path.resolve(__dirname, '..', '..');

const sharedEnv = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'info',
};

module.exports = {
  apps: [
    {
      name: 'admin-api',
      cwd,
      script: 'dist/apps/admin-api/main.js',
      exec_mode: 'cluster',
      instances: 2,
      max_memory_restart: '512M',
      env: {
        ...sharedEnv,
        APP_NAME: 'admin-api',
        ADMIN_API_PORT: 3001,
      },
    },
    {
      name: 'user-api',
      cwd,
      script: 'dist/apps/user-api/main.js',
      exec_mode: 'cluster',
      instances: 'max',
      max_memory_restart: '512M',
      env: {
        ...sharedEnv,
        APP_NAME: 'user-api',
        USER_API_PORT: 3002,
      },
    },
    {
      // Worker runs as a single fork: BullMQ scales via internal concurrency,
      // and a single scheduler avoids duplicate cron firing.
      name: 'worker',
      cwd,
      script: 'dist/apps/worker/main.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '512M',
      env: {
        ...sharedEnv,
        APP_NAME: 'worker',
        WORKER_CONCURRENCY: 5,
        WORKER_ENABLE_SCHEDULE: 'true',
        WORKER_HEALTH_PORT: 3003,
      },
    },
  ],
};
