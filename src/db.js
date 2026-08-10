const { Pool } = require('pg');

// Neon requires SSL. DATABASE_URL comes from your Neon project's
// "Connection string" (use the pooled connection string on Vercel).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
