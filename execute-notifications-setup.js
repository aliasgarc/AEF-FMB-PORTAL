// Execute Notifications Setup SQL Commands
require('dotenv').config();
const db = require('./src/db');

const setupSQL = `
-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  is_active BOOLEAN DEFAULT true
);

-- 2. Create notification read status table
CREATE TABLE IF NOT EXISTS notification_reads (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  its_id VARCHAR(50) NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_active ON notifications(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_reads_its ON notification_reads(its_id, read_at);
`;

async function setupNotifications() {
  try {
    console.log('🔔 Starting Notifications Setup...\n');

    const statements = setupSQL.split(';').filter(stmt => stmt.trim());

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        console.log(`[${i + 1}/${statements.length}] Executing...`);
        try {
          await db.query(statement);
          console.log(`✅ Success\n`);
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log(`✅ Already exists\n`);
          } else {
            console.error(`❌ Error: ${err.message}\n`);
          }
        }
      }
    }

    // Verify setup
    console.log('\n📊 Verifying Setup...\n');

    const notificationsCheck = await db.query(
      "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') as exists"
    );
    console.log(`✓ notifications table: ${notificationsCheck.rows[0].exists ? '✅ EXISTS' : '❌ MISSING'}`);

    const readsCheck = await db.query(
      "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_reads') as exists"
    );
    console.log(`✓ notification_reads table: ${readsCheck.rows[0].exists ? '✅ EXISTS' : '❌ MISSING'}`);

    console.log('\n🎉 Notifications System Ready!\n');
    console.log('Next steps:');
    console.log('1. Add notification routes to API');
    console.log('2. Add notification UI to admin panel');
    console.log('3. Add notification display to user portal\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Setup failed:', err);
    process.exit(1);
  }
}

setupNotifications();
