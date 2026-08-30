const db = require('../src/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('Starting push notifications migration...\n');

    // Read the SQL file
    const sqlFile = fs.readFileSync(path.join(__dirname, 'add-push-notifications.sql'), 'utf8');

    // Execute the migration
    await db.query(sqlFile);

    console.log('✅ Migration completed successfully!\n');
    console.log('Created tables:');
    console.log('  - push_notifications');
    console.log('  - push_notification_recipients');
    console.log('\nTables are ready for push notification system.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
