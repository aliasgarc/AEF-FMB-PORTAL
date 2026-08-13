#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123456',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'test_portal_db'
});

// Read SQL file
const sqlFile = path.join(__dirname, 'db', 'add-previous-amount-due.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

// Execute
(async () => {
  try {
    console.log('🔄 Adding previous_amount_due column...');
    await pool.query(sql);
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
