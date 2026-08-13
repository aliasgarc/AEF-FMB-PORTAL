-- User Tracking System Setup
-- Executed: 2026-08-14

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

-- 3. Add timestamp columns to fmb_payment_tbl if they don't exist
ALTER TABLE fmb_payment_tbl
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 4. Add timestamp columns to fmb_takhmeen if they don't exist
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

-- 6. Drop existing trigger if it exists and create new one
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

-- 8. Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS takhmeen_update_trigger ON fmb_takhmeen;
CREATE TRIGGER takhmeen_update_trigger
BEFORE UPDATE ON fmb_takhmeen
FOR EACH ROW
EXECUTE FUNCTION update_takhmeen_timestamp();

-- 9. Verify tables were created/updated
SELECT
  'Setup Complete!' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_fetch_history') as tracking_table_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'fmb_payment_tbl' AND column_name = 'updated_at') as payment_updated_at_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'fmb_takhmeen' AND column_name = 'updated_at') as takhmeen_updated_at_exists;
