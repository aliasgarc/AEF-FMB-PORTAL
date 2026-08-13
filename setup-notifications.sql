-- Notifications System Setup

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

-- 4. Verify tables
SELECT 'Notifications table created' as status;
SELECT COUNT(*) as notification_count FROM notifications;
SELECT COUNT(*) as notification_reads_count FROM notification_reads;
