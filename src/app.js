const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const notificationRoutes = require('./routes/notifications');
const appUpdatesRoutes = require('./routes/app-updates');
const appAnalyticsRoutes = require('./routes/app-analytics');
const pushNotificationsRoutes = require('./routes/push-notifications');

const app = express();

app.use(express.json());
app.use(cookieParser());

// Enable CORS for API endpoints (needed for PWA on different origin)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Static assets (logo, css, js)
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, path) => {
    // Service worker must always be fresh (never cached)
    if (path.endsWith('service-worker.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    if (path.endsWith('manifest.json')) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
    if (path.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }
}));

// Static front-ends
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));
app.use('/user', express.static(path.join(__dirname, '..', 'public', 'user')));

// APIs
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushNotificationsRoutes);
app.use('/api/app', appUpdatesRoutes);
app.use('/api/app-analytics', appAnalyticsRoutes);

// Root -> send people to the user portal by default
app.get('/', (req, res) => {
  res.redirect('/user');
});

// /admin (no trailing file) -> login page
app.get('/admin', (req, res) => {
  res.redirect('/admin/login.html');
});

app.get('/health', (req, res) => res.json({ ok: true }));

module.exports = app;
