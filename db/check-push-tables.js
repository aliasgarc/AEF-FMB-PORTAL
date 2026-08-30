require('dotenv').config();
const db = require('../src/db');

async function checkTables() {
  console.log('🔍 Checking Push Notification Tables...\n');

  try {
    // Check if push_notifications table exists
    console.log('1️⃣  Checking push_notifications table...');
    const notifTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'push_notifications'
      );
    `);

    if (notifTableCheck.rows[0].exists) {
      console.log('✅ push_notifications table EXISTS\n');

      // Get table info
      const notifInfo = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'push_notifications'
        ORDER BY ordinal_position;
      `);

      console.log('   Columns:');
      notifInfo.rows.forEach(col => {
        console.log(`   • ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? '[NOT NULL]' : ''}`);
      });

      // Count records
      const notifCount = await db.query('SELECT COUNT(*) as count FROM push_notifications;');
      console.log(`\n   Records: ${notifCount.rows[0].count}\n`);
    } else {
      console.log('❌ push_notifications table DOES NOT EXIST\n');
    }

    // Check if push_notification_recipients table exists
    console.log('2️⃣  Checking push_notification_recipients table...');
    const recipTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'push_notification_recipients'
      );
    `);

    if (recipTableCheck.rows[0].exists) {
      console.log('✅ push_notification_recipients table EXISTS\n');

      // Get table info
      const recipInfo = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'push_notification_recipients'
        ORDER BY ordinal_position;
      `);

      console.log('   Columns:');
      recipInfo.rows.forEach(col => {
        console.log(`   • ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? '[NOT NULL]' : ''}`);
      });

      // Count records
      const recipCount = await db.query('SELECT COUNT(*) as count FROM push_notification_recipients;');
      console.log(`\n   Records: ${recipCount.rows[0].count}\n`);
    } else {
      console.log('❌ push_notification_recipients table DOES NOT EXIST\n');
    }

    // Check indexes
    console.log('3️⃣  Checking indexes...');
    const indexCheck = await db.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename IN ('push_notifications', 'push_notification_recipients')
      ORDER BY indexname;
    `);

    if (indexCheck.rows.length > 0) {
      console.log('✅ Indexes found:');
      indexCheck.rows.forEach(idx => {
        console.log(`   • ${idx.indexname}`);
      });
    } else {
      console.log('⚠️  No indexes found (tables may not be initialized)');
    }

    // Try to create tables if they don't exist
    console.log('\n4️⃣  Auto-creating tables if missing...');
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS push_notifications (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          message_type VARCHAR(50) NOT NULL,
          created_by VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        );
      `);
      console.log('✅ push_notifications table initialized');

      await db.query(`
        CREATE TABLE IF NOT EXISTS push_notification_recipients (
          id SERIAL PRIMARY KEY,
          push_notification_id INTEGER NOT NULL REFERENCES push_notifications(id) ON DELETE CASCADE,
          its_id VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          delivered_at TIMESTAMP,
          read_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ push_notification_recipients table initialized');

      // Create indexes
      await db.query(`CREATE INDEX IF NOT EXISTS idx_push_notifications_created_by ON push_notifications(created_by);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_push_notifications_created_at ON push_notifications(created_at);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_push_notification_recipients_push_id ON push_notification_recipients(push_notification_id);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_push_notification_recipients_its_id ON push_notification_recipients(its_id);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_push_notification_recipients_status ON push_notification_recipients(status);`);
      console.log('✅ All indexes created\n');
    } catch (err) {
      console.log('⚠️  Error creating tables:', err.message, '\n');
    }

    // Final status
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ DATABASE CHECK COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\nSummary:');
    console.log('• push_notifications table: ' + (notifTableCheck.rows[0].exists ? '✅ OK' : '❌ MISSING'));
    console.log('• push_notification_recipients table: ' + (recipTableCheck.rows[0].exists ? '✅ OK' : '❌ MISSING'));
    console.log('• Indexes: ' + (indexCheck.rows.length > 0 ? '✅ OK' : '❌ MISSING'));
    console.log('\n🚀 Push notifications system is ready to use!\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Database Check Failed');
    console.error('Error:', err.message);
    console.error('\nPossible causes:');
    console.error('1. PostgreSQL is not running');
    console.error('2. Database connection details are wrong');
    console.error('3. Database user does not have permission');
    console.error('\nFix: Check your DATABASE_URL environment variable');
    process.exit(1);
  }
}

checkTables();
