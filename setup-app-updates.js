// Setup App Updates Table
require('dotenv').config();
const db = require('./src/db');

const setupSQL = `
-- Create app_updates table
CREATE TABLE IF NOT EXISTS app_updates (
  id SERIAL PRIMARY KEY,
  version VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  app_type VARCHAR(50) DEFAULT 'both',  -- 'user', 'admin', or 'both'
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  download_url VARCHAR(255)
);

-- Create index for fast queries
CREATE INDEX IF NOT EXISTS idx_app_updates_version ON app_updates(version DESC);
CREATE INDEX IF NOT EXISTS idx_app_updates_active ON app_updates(is_active, created_at DESC);
`;

async function setupAppUpdates() {
  try {
    console.log('🔄 Starting App Updates Setup...\n');

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
    console.log('📊 Verifying Setup...\n');

    const tableCheck = await db.query(
      "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'app_updates') as exists"
    );
    console.log(`✓ app_updates table: ${tableCheck.rows[0].exists ? '✅ EXISTS' : '❌ MISSING'}`);

    const indexCheck = await db.query(
      "SELECT COUNT(*) as count FROM information_schema.statistics WHERE table_name = 'app_updates' AND index_name LIKE 'idx_app_updates%'"
    );
    console.log(`✓ Indexes created: ${indexCheck.rows[0].count} indexes found`);

    console.log('\n🎉 App Updates Setup Complete!\n');
    console.log('Features:');
    console.log('  • Track app versions');
    console.log('  • Send update notifications');
    console.log('  • Notify users of new features');
    console.log('  • Separate notifications for admin/user apps\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Setup failed:', err);
    process.exit(1);
  }
}

setupAppUpdates();
