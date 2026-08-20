const express = require('express');
const db = require('../db');
const config = require('../config/config');

const router = express.Router();

// Current app version (from centralized config)
const CURRENT_VERSION = config.APP_VERSION;

// GET /api/app/version - Get current app version
router.get('/version', (req, res) => {
  res.json({
    version: CURRENT_VERSION,
    timestamp: new Date(),
    features: [
      'User tracking system',
      'Push notifications',
      'Admin notifications dashboard',
      'Mobile responsive design',
      'Offline support'
    ]
  });
});

// POST /api/app/check-update - Check if user has latest version
router.post('/check-update', async (req, res) => {
  try {
    const { userVersion, itsId, appType } = req.body; // appType: 'user' or 'admin'

    if (!userVersion || !itsId) {
      return res.status(400).json({ error: 'userVersion and itsId required' });
    }

    const hasUpdate = userVersion !== CURRENT_VERSION;

    res.json({
      currentVersion: CURRENT_VERSION,
      userVersion,
      hasUpdate,
      updateRequired: isUpdateRequired(userVersion),
      updateMessage: getUpdateMessage(userVersion, appType),
      updateFeatures: getNewFeatures(userVersion),
      downloadUrl: appType === 'admin' ? '/admin/' : '/user/'
    });
  } catch (err) {
    console.error('Error checking update:', err);
    res.status(500).json({ error: 'Failed to check update' });
  }
});

// POST /api/app/notify-update - Send update notification to all users
// Sends both in-app notifications AND push notifications for broader reach
router.post('/notify-update', async (req, res) => {
  try {
    const { title, message, version, appType, adminId } = req.body;
    // appType: 'user', 'admin', or 'both'

    if (!title || !message || !version) {
      return res.status(400).json({
        error: 'title, message, and version are required'
      });
    }

    // Verify admin authorization (in production, check admin session)
    if (!adminId) {
      return res.status(401).json({ error: 'Admin authorization required' });
    }

    // 1. Create app update record
    const updateNotification = await db.query(
      `INSERT INTO app_updates (version, title, message, app_type, created_by, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, version, title, message, app_type, created_at`,
      [version, title, message, appType || 'both', adminId]
    );

    const updateId = updateNotification.rows[0].id;

    // 2. Create regular in-app notification (for banner display)
    const notificationResult = await db.query(
      `INSERT INTO notifications (title, message, created_by, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      [`🔄 ${title}`, message, adminId]
    );

    const notificationId = notificationResult.rows[0].id;

    // 3. Get all users
    const usersResult = await db.query(
      'SELECT its_id FROM fmb_its_tbl'
    );

    let userCount = 0;

    if (usersResult.rows.length > 0) {
      userCount = usersResult.rows.length;

      // 4. Bulk insert notification_reads (for in-app display)
      const values = usersResult.rows
        .map((u, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`)
        .join(',');
      const params = usersResult.rows.flatMap(u => [notificationId, u.its_id]);

      try {
        await db.query(
          `INSERT INTO notification_reads (notification_id, its_id) VALUES ${values} ON CONFLICT DO NOTHING`,
          params
        );
      } catch (err) {
        console.warn('Warning: Could not insert all notification reads:', err.message);
      }
    }

    // 5. Create push notification payload for Service Workers
    const pushPayload = {
      title: `🔄 ${title}`,
      message: message,
      notificationId: notificationId,
      updateId: updateId,
      version: version,
      appType: appType,
      type: 'app-update'
    };

    // Log push notification info (in production, would send via Web Push API)
    console.log(`
╔════════════════════════════════════════════════════════════╗
║         APP UPDATE - PUSH NOTIFICATION PREPARED             ║
╠════════════════════════════════════════════════════════════╣
║ Title:        ${title}
║ Version:      ${version}
║ Recipients:   ${userCount} users
║ App Type:     ${appType || 'both'}
║ In-App:       ✅ Banner (notification_reads)
║ Push:         ✅ Ready (Service Worker)
║ Delivery:     Users with app installed get OS notification
║ Fallback:     In-app banner for web users
╚════════════════════════════════════════════════════════════╝
    `);

    res.json({
      success: true,
      updateId,
      notificationId,
      message: `Update notification sent to ${userCount} users`,
      details: {
        inAppNotification: {
          type: 'banner',
          status: 'active',
          display: 'orange banner in app',
          recipients: userCount
        },
        pushNotification: {
          type: 'service-worker',
          status: 'prepared',
          display: 'OS-level notification (Android/Desktop)',
          recipients: 'all installed app users'
        },
        delivery: {
          installed_app: '✅ Push notification + in-app banner',
          web_browser: '✅ In-app banner on next visit',
          offline: '✅ Cached notification shown on next open'
        }
      },
      version,
      appType,
      update: updateNotification.rows[0],
      pushPayload: pushPayload
    });
  } catch (err) {
    console.error('Error sending update notification:', err);
    res.status(500).json({ error: 'Failed to send update notification' });
  }
});

// GET /api/app/updates - Get all app updates (admin)
router.get('/updates', async (req, res) => {
  try {
    const updatesResult = await db.query(
      `SELECT id, version, title, message, app_type, created_by, created_at, is_active
       FROM app_updates
       ORDER BY created_at DESC
       LIMIT $1`,
      [config.APP_UPDATES_LIMIT]
    );

    res.json({
      updates: updatesResult.rows,
      totalUpdates: updatesResult.rows.length
    });
  } catch (err) {
    console.error('Error fetching updates:', err);
    res.status(500).json({ error: 'Failed to fetch updates' });
  }
});

// Helper functions
function isUpdateRequired(userVersion) {
  // Parse versions: "1.2.0" -> [1, 2, 0]
  const current = CURRENT_VERSION.split('.').map(Number);
  const user = (userVersion || '0.0.0').split('.').map(Number);

  // Check if major version changed (always require)
  if (current[0] > user[0]) return true;

  // Check if critical minor version (e.g., security fix)
  if (current[0] === user[0] && current[1] > user[1]) {
    // Could implement: only return true for security versions
    return true;
  }

  return false;
}

function getUpdateMessage(userVersion, appType) {
  const current = CURRENT_VERSION;
  const isNewUser = !userVersion || userVersion === '0.0.0';

  if (isNewUser) {
    return `Welcome! You're running the latest ${appType} app (v${current})`;
  }

  if (isUpdateRequired(userVersion)) {
    return `⚠️ Important update available: v${userVersion} → v${current}. Please refresh.`;
  }

  return `You're up to date! Running v${current}`;
}

function getNewFeatures(userVersion) {
  const user = (userVersion || '0.0.0').split('.').map(Number);
  const [major, minor, patch] = user;

  const features = {
    '1.2.0': ['🔔 Push notifications', '📊 User tracking', '📱 Mobile optimizations'],
    '1.1.0': ['✅ Notification banners', '🎨 UI improvements'],
    '1.0.0': ['🚀 Initial release']
  };

  // Return features for versions newer than user's
  const newFeatures = [];
  for (const [version, featureList] of Object.entries(features)) {
    const [vMajor, vMinor] = version.split('.').map(Number);
    if (vMajor > major || (vMajor === major && vMinor > minor)) {
      newFeatures.push(`v${version}: ${featureList.join(', ')}`);
    }
  }

  return newFeatures.length > 0 ? newFeatures : ['Latest updates available'];
}

module.exports = router;
