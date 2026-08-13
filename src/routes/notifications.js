const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/notifications/:itsId - Fetch unread notifications for a user
router.get('/:itsId', async (req, res) => {
  try {
    const itsId = String(req.params.itsId || '').trim();
    if (!itsId) {
      return res.status(400).json({ error: 'ITS ID is required' });
    }

    // Get all active notifications
    const notificationsResult = await db.query(
      `SELECT
        n.id,
        n.title,
        n.message,
        n.created_at,
        COALESCE(nr.read_at, NULL) as read_at,
        CASE WHEN nr.read_at IS NULL THEN true ELSE false END as is_unread
      FROM notifications n
      LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.its_id = $1
      WHERE n.is_active = true
      ORDER BY n.created_at DESC
      LIMIT 50`,
      [itsId]
    );

    res.json({
      notifications: notificationsResult.rows,
      unreadCount: notificationsResult.rows.filter(n => n.is_unread).length
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /api/admin/notifications - Create and send notification to all users
router.post('/admin/send', async (req, res) => {
  try {
    const { title, message, adminId } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    if (title.length > 255) {
      return res.status(400).json({ error: 'Title must be 255 characters or less' });
    }

    // Insert notification
    const notificationResult = await db.query(
      `INSERT INTO notifications (title, message, created_by, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, title, message, created_at`,
      [title, message, adminId || 'System']
    );

    const notificationId = notificationResult.rows[0].id;

    // Get all users
    const usersResult = await db.query(
      'SELECT its_id FROM fmb_its_tbl'
    );

    // Create read records for all users (initially unread) using bulk insert
    if (usersResult.rows.length > 0) {
      const values = usersResult.rows.map((u, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(',');
      const params = usersResult.rows.flatMap(u => [notificationId, u.its_id]);

      try {
        await db.query(
          `INSERT INTO notification_reads (notification_id, its_id) VALUES ${values} ON CONFLICT DO NOTHING`,
          params
        );
      } catch (err) {
        console.warn('Warning: Could not insert all notification reads:', err.message);
        // Continue even if this fails, notification was created
      }
    }

    res.json({
      success: true,
      notificationId,
      message: `Notification sent to ${usersResult.rows.length} users`,
      notification: notificationResult.rows[0]
    });
  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// POST /api/notifications/:itsId/:notificationId/read - Mark notification as read
router.post('/:itsId/:notificationId/read', async (req, res) => {
  try {
    const { itsId, notificationId } = req.params;

    await db.query(
      `UPDATE notification_reads
       SET read_at = CURRENT_TIMESTAMP
       WHERE notification_id = $1 AND its_id = $2`,
      [notificationId, itsId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// GET /api/admin/notifications - Fetch all notifications (admin)
router.get('/admin/all', async (req, res) => {
  try {
    const notificationsResult = await db.query(
      `SELECT
        id,
        title,
        message,
        created_at,
        created_by,
        is_active
      FROM notifications
      ORDER BY created_at DESC
      LIMIT 100`
    );

    res.json({ notifications: notificationsResult.rows });
  } catch (err) {
    console.error('Error fetching admin notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

module.exports = router;
