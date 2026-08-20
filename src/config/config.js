// Centralized configuration for the application
module.exports = {
  // File uploads
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || 10 * 1024 * 1024, // 10 MB default

  // Timeouts (ms)
  FETCH_TIMEOUT: process.env.FETCH_TIMEOUT || 30000,
  SERVICE_WORKER_TIMEOUT: process.env.SERVICE_WORKER_TIMEOUT || 5000,

  // Database limits
  PAYMENTS_LIMIT: process.env.PAYMENTS_LIMIT || 1000,
  NOTIFICATIONS_LIMIT: process.env.NOTIFICATIONS_LIMIT || 50,
  NOTIFICATIONS_ADMIN_LIMIT: process.env.NOTIFICATIONS_ADMIN_LIMIT || 100,
  APP_UPDATES_LIMIT: process.env.APP_UPDATES_LIMIT || 50,
  USERS_LIMIT: process.env.USERS_LIMIT || 10000,

  // Feature flags
  ENABLE_DEBUG_LOGS: process.env.NODE_ENV !== 'production',
};
