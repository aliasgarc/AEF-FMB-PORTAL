const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const notificationRoutes = require('./routes/notifications');
const appUpdatesRoutes = require('./routes/app-updates');
const appAnalyticsRoutes = require('./routes/app-analytics');

const app = express();

app.use(express.json());
app.use(cookieParser());

// Static assets (logo, css, js)
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, path) => {
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
