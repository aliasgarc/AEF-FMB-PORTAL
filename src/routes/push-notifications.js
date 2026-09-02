const express = require('express');
const db = require('../db');
const webpush = require('web-push');

const router = express.Router();

// Set VAPID details (generate with: npx web-push generate-vapid-keys)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BO73qWfhrM8ccH3qw-K0caUugIW0Em2SI2PO1dkQDC4XEMQlxmLh1vyZQPAIhBSPbidLN3qduAiipVaQDj2NAZk';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'ThmP0e8QXuStO6RhANqzgXDRXLH9Ss4oQdxit2BlCr4';

// Set VAPID subject (must be a mailto or https URL)
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:example@example.com';

// Set webpush with VAPID keys
webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

// Initialize database tables if they don't exist
async function initializeTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        its_id VARCHAR(50) NOT NULL,
        subscription_endpoint VARCHAR(500) NOT NULL UNIQUE,
        auth_key VARCHAR(255),
        p256dh_key VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    await db.query(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_its_id ON push_subscriptions(its_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_push_notifications_created_by ON push_notifications(created_by)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_push_notifications_created_at ON push_notifications(created_at)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_push_notification_recipients_push_id ON push_notification_recipients(push_notification_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_push_notification_recipients_its_id ON push_notification_recipients(its_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_push_notification_recipients_status ON push_notification_recipients(status)`);
  } catch (err) {
    console.warn('Warning: Could not initialize push notification tables:', err.message);
  }
}

// Initialize tables on router load
initializeTables();

// GET /api/push/vapid-public-key - Get public key for client subscription
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

// POST /api/push/subscribe - Save push subscription for user
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, its_id } = req.body;

    if (!subscription || !its_id) {
      return res.status(400).json({ error: 'subscription and its_id required' });
    }

    // Store subscription in database
    await db.query(
      `INSERT INTO push_subscriptions (its_id, subscription_endpoint, auth_key, p256dh_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (subscription_endpoint) DO UPDATE
       SET its_id = $1, auth_key = $3, p256dh_key = $4`,
      [
        its_id,
        subscription.endpoint,
        subscription.keys?.auth,
        subscription.keys?.p256dh
      ]
    );

    console.log(`✅ Push subscription saved for user ${its_id}`);
    res.json({ success: true, message: 'Subscription saved' });
  } catch (err) {
    console.error('Error saving subscription:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// POST /api/push/send - Send push notification
router.post('/send', async (req, res) => {
  try {
    const {
      recipient_type,  // 'all' or 'specific'
      its_ids,         // array of its_ids (only if specific)
      message_type,    // 'custom', 'auto_takhmeen', 'auto_pending'
      title,
      custom_message,
      admin_id
    } = req.body;

    // Validation
    if (!title || !message_type) {
      return res.status(400).json({ error: 'title and message_type are required' });
    }

    if (recipient_type !== 'all' && recipient_type !== 'specific' && recipient_type !== 'bulk_pending') {
      return res.status(400).json({ error: 'recipient_type must be "all", "specific", or "bulk_pending"' });
    }

    if (recipient_type === 'specific' && (!its_ids || !Array.isArray(its_ids) || its_ids.length === 0)) {
      return res.status(400).json({ error: 'its_ids array required for specific recipients' });
    }

    // Convert ITS IDs to strings
    let recipientIds = its_ids;
    if (recipient_type === 'specific') {
      recipientIds = its_ids.map(id => String(id).trim());
    }

    if (message_type === 'custom' && !custom_message) {
      return res.status(400).json({ error: 'custom_message required for custom message type' });
    }

    // Verify admin authorization
    if (!admin_id) {
      return res.status(401).json({ error: 'Admin authorization required' });
    }

    // Get recipient list
    let recipients = [];
    if (recipient_type === 'all') {
      const result = await db.query('SELECT its_id FROM fmb_its_tbl WHERE its_id IS NOT NULL');
      recipients = result.rows.map(row => row.its_id);
    } else if (recipient_type === 'bulk_pending') {
      // Get all users with pending amounts
      const result = await db.query(`
        SELECT DISTINCT pt.hof_its as its_id
        FROM fmb_payment_tbl pt
        WHERE pt.amt_pending > 0
      `);
      recipients = result.rows.map(row => row.its_id);
      // Override recipient_type for logging
      console.log(`Found ${recipients.length} users with pending amounts`);
    } else {
      recipients = recipientIds;
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No valid recipients found' });
    }

    // Generate messages based on type
    let messages = [];
    if (message_type === 'custom') {
      messages = recipients.map(its_id => ({
        its_id,
        message: custom_message
      }));
    } else if (message_type === 'auto_takhmeen') {
      const placeholders = recipients.map((_, i) => `$${i + 1}`).join(',');
      const result = await db.query(
        `SELECT its_id, COALESCE(SUM(amount), 0) as takhmeen_amount
         FROM fmb_takhmeen
         WHERE its_id IN (${placeholders})
         GROUP BY its_id`,
        recipients
      );

      const takhmeenMap = {};
      result.rows.forEach(row => {
        takhmeenMap[row.its_id] = row.takhmeen_amount;
      });

      messages = recipients.map(its_id => ({
        its_id,
        message: `Your Takhmeen: ₹${(takhmeenMap[its_id] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      }));
    } else if (message_type === 'auto_pending' || message_type === 'bulk_pending') {
      const placeholders = recipients.map((_, i) => `$${i + 1}`).join(',');
      const result = await db.query(
        `SELECT pt.hof_its as its_id, COALESCE(SUM(pt.amt_pending), 0) as pending_amount
         FROM fmb_payment_tbl pt
         WHERE pt.hof_its IN (${placeholders})
         AND pt.amt_pending > 0
         GROUP BY pt.hof_its`,
        recipients
      );

      const pendingMap = {};
      result.rows.forEach(row => {
        pendingMap[row.its_id] = row.pending_amount;
      });

      messages = recipients.map(its_id => {
        const amount = pendingMap[its_id] || 0;
        // For bulk_pending, only include users with actual pending amounts
        if (message_type === 'bulk_pending' && amount === 0) {
          return null;
        }
        return {
          its_id,
          message: `Pending Payment: ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
        };
      }).filter(msg => msg !== null); // Remove null entries
    }

    // Create push notification record
    const notifResult = await db.query(
      `INSERT INTO push_notifications (title, message, message_type, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, message_type, created_at`,
      [title, message_type === 'custom' ? custom_message : '', message_type, admin_id]
    );

    const push_notification_id = notifResult.rows[0].id;

    // Insert recipient records
    const recipientValues = messages
      .map((msg, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`)
      .join(',');

    const recipientParams = messages.flatMap(msg => [push_notification_id, msg.its_id]);

    await db.query(
      `INSERT INTO push_notification_recipients (push_notification_id, its_id)
       VALUES ${recipientValues}`,
      recipientParams
    );

    // SEND ACTUAL PUSH NOTIFICATIONS
    let sentCount = 0;
    let failedCount = 0;

    for (const msg of messages) {
      try {
        // Get subscriptions for this user
        const subResult = await db.query(
          'SELECT subscription_endpoint, auth_key, p256dh_key FROM push_subscriptions WHERE its_id = $1',
          [msg.its_id]
        );

        if (subResult.rows.length === 0) {
          console.warn(`⚠️  No push subscription found for user ${msg.its_id}`);
          failedCount++;
          continue;
        }

        // Send to each subscription
        for (const sub of subResult.rows) {
          const payload = JSON.stringify({
            title: title,
            message: msg.message,
            push_notification_id: push_notification_id,
            its_id: msg.its_id,
            message_type: message_type
          });

          const subscription = {
            endpoint: sub.subscription_endpoint,
            keys: {
              auth: sub.auth_key,
              p256dh: sub.p256dh_key
            }
          };

          try {
            await webpush.sendNotification(subscription, payload);
            sentCount++;
          } catch (err) {
            console.error(`Failed to send to ${msg.its_id}:`, err.message);
            failedCount++;
          }
        }
      } catch (err) {
        console.error(`Error processing notifications for ${msg.its_id}:`, err);
        failedCount++;
      }
    }

    console.log(`
╔════════════════════════════════════════════════════════════╗
║         PUSH NOTIFICATION - SENT                           ║
╠════════════════════════════════════════════════════════════╣
║ Title:        ${title}
║ Type:         ${message_type}
║ Recipients:   ${recipients.length} users
║ Sent:         ${sentCount} notifications
║ Failed:       ${failedCount} notifications
║ Recipient Type: ${recipient_type}
║ Created By:   ${admin_id}
╚════════════════════════════════════════════════════════════╝
    `);

    res.json({
      success: true,
      push_notification_id,
      message: `Push notification sent to ${sentCount} users`,
      details: {
        title,
        message_type,
        recipient_count: recipients.length,
        sent_count: sentCount,
        failed_count: failedCount,
        recipient_type
      }
    });
  } catch (err) {
    console.error('❌ Error sending push notification:', err);

    let errorMsg = err.message;
    if (err.code === '42P01') {
      errorMsg = 'Database tables not found. Please call /api/push/init first.';
    } else if (err.message.includes('duplicate key')) {
      errorMsg = 'This notification may have already been sent.';
    }

    res.status(500).json({
      error: 'Failed to send push notification',
      detail: errorMsg,
      hint: 'Check server logs for full error details'
    });
  }
});

// GET /api/push/init - Initialize database tables
router.get('/init', async (req, res) => {
  try {
    console.log('🔨 Manually initializing push notification tables...');
    await initializeTables();

    const result = await db.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('push_notifications', 'push_notification_recipients', 'push_subscriptions')
    `);

    if (result.rows.length === 3) {
      res.json({
        success: true,
        message: 'Push notification tables initialized successfully',
        tables: result.rows.map(r => r.tablename)
      });
    } else {
      res.status(500).json({
        error: 'Not all tables were created',
        found: result.rows.length,
        expected: 3
      });
    }
  } catch (err) {
    console.error('Error initializing tables:', err);
    res.status(500).json({
      error: 'Failed to initialize tables',
      detail: err.message
    });
  }
});

// GET /api/push/history - Get push notification history
router.get('/history', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT pn.id, pn.title, pn.message_type, pn.created_by, pn.created_at,
              COUNT(pnr.id) as recipient_count,
              SUM(CASE WHEN pnr.status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
              SUM(CASE WHEN pnr.status = 'read' THEN 1 ELSE 0 END) as read_count
       FROM push_notifications pn
       LEFT JOIN push_notification_recipients pnr ON pn.id = pnr.push_notification_id
       GROUP BY pn.id
       ORDER BY pn.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      notifications: result.rows,
      total: result.rows.length
    });
  } catch (err) {
    console.error('Error fetching push notification history:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// POST /api/push/mark-delivered - Mark notification as delivered
router.post('/mark-delivered', async (req, res) => {
  try {
    const { push_notification_id, its_id } = req.body;

    if (!push_notification_id || !its_id) {
      return res.status(400).json({ error: 'push_notification_id and its_id required' });
    }

    await db.query(
      `UPDATE push_notification_recipients
       SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP
       WHERE push_notification_id = $1 AND its_id = $2`,
      [push_notification_id, its_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification as delivered:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// POST /api/push/mark-read - Mark notification as read
router.post('/mark-read', async (req, res) => {
  try {
    const { push_notification_id, its_id } = req.body;

    if (!push_notification_id || !its_id) {
      return res.status(400).json({ error: 'push_notification_id and its_id required' });
    }

    await db.query(
      `UPDATE push_notification_recipients
       SET status = 'read', read_at = CURRENT_TIMESTAMP
       WHERE push_notification_id = $1 AND its_id = $2`,
      [push_notification_id, its_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;
