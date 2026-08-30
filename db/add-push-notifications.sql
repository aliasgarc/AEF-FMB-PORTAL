-- Push Notifications System
-- Tables for storing and tracking push notifications sent to specific users

BEGIN;

-- Table to store push notification templates/records
CREATE TABLE IF NOT EXISTS push_notifications (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  message_type VARCHAR(50) NOT NULL, -- 'custom', 'auto_takhmeen', 'auto_pending'
  created_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Table to track which users received which notifications
CREATE TABLE IF NOT EXISTS push_notification_recipients (
  id SERIAL PRIMARY KEY,
  push_notification_id INTEGER NOT NULL REFERENCES push_notifications(id) ON DELETE CASCADE,
  its_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'delivered', 'failed', 'read'
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_push_notifications_created_by ON push_notifications(created_by);
CREATE INDEX IF NOT EXISTS idx_push_notifications_created_at ON push_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_push_notification_recipients_push_id ON push_notification_recipients(push_notification_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_recipients_its_id ON push_notification_recipients(its_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_recipients_status ON push_notification_recipients(status);

COMMIT;
