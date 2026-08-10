// Vercel serverless entry point. Wraps the same Express app used
// locally — all routes and logic live in src/app.js.
const app = require('../src/app');

module.exports = app;
