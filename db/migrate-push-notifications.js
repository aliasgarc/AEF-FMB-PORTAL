const db = require('../src/db');

async function migrate() {
  try {
    console.log('Starting push notifications migration...\n');

    // Create push_notifications table
    console.log('Creating push_notifications table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS push_notifications (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        message_type VARCHAR(50) NOT NULL,
        created_by VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `);
    console.log('✅ push_notifications table created');

    // Create push_notification_recipients table
    console.log('Creating push_notification_recipients table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS push_notification_recipients (
        id SERIAL PRIMARY KEY,
        push_notification_id INTEGER NOT NULL REFERENCES push_notifications(id) ON DELETE CASCADE,
        its_id VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        delivered_at TIMESTAMP,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ push_notification_recipients table created');

    // Create indexes
    console.log('Creating indexes...');
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_push_notifications_created_by ON push_notifications(created_by)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_push_notifications_created_at ON push_notifications(created_at)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_push_notification_recipients_push_id ON push_notification_recipients(push_notification_id)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_push_notification_recipients_its_id ON push_notification_recipients(its_id)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_push_notification_recipients_status ON push_notification_recipients(status)
    `);
    console.log('✅ All indexes created');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nTables ready:');
    console.log('  - push_notifications');
    console.log('  - push_notification_recipients');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

migrate();
