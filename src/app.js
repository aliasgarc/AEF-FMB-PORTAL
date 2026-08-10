const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

const app = express();

app.use(express.json());
app.use(cookieParser());

// Static assets (logo, css, js)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Static front-ends
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));
app.use('/user', express.static(path.join(__dirname, '..', 'public', 'user')));

// APIs
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

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
