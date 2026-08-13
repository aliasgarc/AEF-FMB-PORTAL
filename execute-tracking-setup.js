// Execute User Tracking Setup SQL Commands
require('dotenv').config();
const db = require('./src/db');

const setupSQL = `
-- 1. Create user fetch history table
CREATE TABLE IF NOT EXISTS user_fetch_history (
  id SERIAL PRIMARY KEY,
  its_id VARCHAR(50) NOT NULL,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255)
);

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_fetch ON user_fetch_history(its_id, fetched_at DESC);

-- 3. Add timestamp columns to fmb_payment_tbl
ALTER TABLE fmb_payment_tbl
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 4. Add timestamp columns to fmb_takhmeen
ALTER TABLE fmb_takhmeen
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 5. Create function to update payment timestamp
CREATE OR REPLACE FUNCTION update_payment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for payment updates
DROP TRIGGER IF EXISTS payment_update_trigger ON fmb_payment_tbl;
CREATE TRIGGER payment_update_trigger
BEFORE UPDATE ON fmb_payment_tbl
FOR EACH ROW
EXECUTE FUNCTION update_payment_timestamp();

-- 7. Create function to update takhmeen timestamp
CREATE OR REPLACE FUNCTION update_takhmeen_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger for takhmeen updates
DROP TRIGGER IF EXISTS takhmeen_update_trigger ON fmb_takhmeen;
CREATE TRIGGER takhmeen_update_trigger
BEFORE UPDATE ON fmb_takhmeen
FOR EACH ROW
EXECUTE FUNCTION update_takhmeen_timestamp();
`;

async function setupTracking() {
  try {
    console.log('🚀 Starting User Tracking Setup...\n');

    // Split the SQL into individual statements and execute each
    const statements = setupSQL.split(';').filter(stmt => stmt.trim());

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        console.log(`[${i + 1}/${statements.length}] Executing command...`);
        try {
          await db.query(statement);
          console.log(`✅ Command executed successfully\n`);
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log(`✅ Already exists (skipped)\n`);
          } else {
            console.error(`❌ Error: ${err.message}\n`);
          }
        }
      }
    }

    // Verify setup
    console.log('\n📊 Verifying Setup...\n');

    const trackingTableCheck = await db.query(
      "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'user_fetch_history') as exists"
    );
    console.log(`✓ user_fetch_history table: ${trackingTableCheck.rows[0].exists ? '✅ EXISTS' : '❌ MISSING'}`);

    const paymentColumnsCheck = await db.query(
      "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'fmb_payment_tbl' AND column_name IN ('updated_at', 'created_at')"
    );
    console.log(`✓ fmb_payment_tbl timestamp columns: ${paymentColumnsCheck.rows[0].count === 2 ? '✅ BOTH EXIST' : '⚠️ PARTIAL'} (found: ${paymentColumnsCheck.rows[0].count}/2)`);

    const takhmeeColumnsCheck = await db.query(
      "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'fmb_takhmeen' AND column_name IN ('updated_at', 'created_at')"
    );
    console.log(`✓ fmb_takhmeen timestamp columns: ${takhmeeColumnsCheck.rows[0].count === 2 ? '✅ BOTH EXIST' : '⚠️ PARTIAL'} (found: ${takhmeeColumnsCheck.rows[0].count}/2)`);

    const triggersCheck = await db.query(
      "SELECT COUNT(*) as count FROM information_schema.triggers WHERE trigger_name IN ('payment_update_trigger', 'takhmeen_update_trigger')"
    );
    console.log(`✓ Update triggers: ${triggersCheck.rows[0].count === 2 ? '✅ BOTH EXIST' : '⚠️ PARTIAL'} (found: ${triggersCheck.rows[0].count}/2)`);

    console.log('\n🎉 Setup Complete! User tracking system is ready to use.\n');
    console.log('Next steps:');
    console.log('1. Restart the application server');
    console.log('2. Add tracking display section to public/user/index.html');
    console.log('3. Test by visiting the user portal and checking for last update dates\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Setup failed:', err);
    process.exit(1);
  }
}

setupTracking();
