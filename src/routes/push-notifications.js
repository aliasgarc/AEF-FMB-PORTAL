const express = require('express');
const db = require('../db');

const router = express.Router();

// Initialize database tables if they don't exist
async function initializeTables() {
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

// POST /api/push/send - Send push notification to specific or all users
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

    if (recipient_type !== 'all' && recipient_type !== 'specific') {
      return res.status(400).json({ error: 'recipient_type must be "all" or "specific"' });
    }

    if (recipient_type === 'specific' && (!its_ids || !Array.isArray(its_ids) || its_ids.length === 0)) {
      return res.status(400).json({ error: 'its_ids array required for specific recipients' });
    }

    if (message_type === 'custom' && !custom_message) {
      return res.status(400).json({ error: 'custom_message required for custom message type' });
    }

    // Verify admin authorization (basic check)
    if (!admin_id) {
      return res.status(401).json({ error: 'Admin authorization required' });
    }

    // Get recipient list
    let recipients = [];
    if (recipient_type === 'all') {
      const result = await db.query('SELECT its_id FROM fmb_its_tbl WHERE its_id IS NOT NULL');
      recipients = result.rows.map(row => row.its_id);
    } else {
      recipients = its_ids;
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
      // Fetch takhmeen for each user
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
    } else if (message_type === 'auto_pending') {
      // Fetch pending amount for each user
      const placeholders = recipients.map((_, i) => `$${i + 1}`).join(',');
      const result = await db.query(
        `SELECT pt.hof_its as its_id, COALESCE(SUM(pt.pending_amount), 0) as pending_amount
         FROM fmb_payment_tbl pt
         WHERE pt.hof_its IN (${placeholders})
         AND pt.pending_amount > 0
         GROUP BY pt.hof_its`,
        recipients
      );

      const pendingMap = {};
      result.rows.forEach(row => {
        pendingMap[row.its_id] = row.pending_amount;
      });

      messages = recipients.map(its_id => ({
        its_id,
        message: `Pending Payment: ₹${(pendingMap[its_id] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      }));
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

    console.log(`
╔════════════════════════════════════════════════════════════╗
║         PUSH NOTIFICATION - SENT SUCCESSFULLY              ║
╠════════════════════════════════════════════════════════════╣
║ Title:        ${title}
║ Type:         ${message_type}
║ Recipients:   ${recipients.length} users
║ Recipient Type: ${recipient_type}
║ Created By:   ${admin_id}
║ Status:       ✅ Queued for delivery
╚════════════════════════════════════════════════════════════╝
    `);

    res.json({
      success: true,
      push_notification_id,
      message: `Push notification queued for ${recipients.length} users`,
      details: {
        title,
        message_type,
        recipient_count: recipients.length,
        recipient_type,
        messages_sample: messages.slice(0, 3)
      }
    });
  } catch (err) {
    console.error('Error sending push notification:', err);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
});

// GET /api/push/history - Get push notification history (admin)
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

// GET /api/push/recipients/:notificationId - Get recipients of a specific notification
router.get('/recipients/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { status } = req.query; // optional filter by status

    let query = `SELECT its_id, status, delivered_at, read_at, created_at
                 FROM push_notification_recipients
                 WHERE push_notification_id = $1`;
    const params = [notificationId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      recipients: result.rows,
      total: result.rows.length
    });
  } catch (err) {
    console.error('Error fetching notification recipients:', err);
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
});

// POST /api/push/mark-delivered - Mark notification as delivered (from service worker)
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

// POST /api/push/mark-read - Mark notification as read (from user portal)
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
