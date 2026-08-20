const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /api/app-analytics/install - Track app installations
router.post('/install', async (req, res) => {
  try {
    const {
      itsId,
      version,
      installationStatus = {},
      timestamp = new Date().toISOString()
    } = req.body;

    if (!itsId || !version) {
      return res.status(400).json({ error: 'itsId and version required' });
    }

    // Try to create table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS app_installations (
        id SERIAL PRIMARY KEY,
        its_id VARCHAR(50) NOT NULL,
        app_version VARCHAR(20) NOT NULL,
        is_installed BOOLEAN DEFAULT true,
        detection_method VARCHAR(50),
        platform VARCHAR(50),
        user_agent TEXT,
        installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {
      // Table might already exist, continue
    });

    // Check if already tracked today
    const today = new Date().toISOString().split('T')[0];
    const existingResult = await db.query(
      `SELECT id FROM app_installations
       WHERE its_id = $1
       AND DATE(installed_at) = $2
       LIMIT 1`,
      [itsId, today]
    );

    if (existingResult.rows.length === 0) {
      // Insert new installation record
      await db.query(
        `INSERT INTO app_installations
         (its_id, app_version, detection_method, platform, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          itsId,
          version,
          installationStatus.detectionMethod || 'web',
          installationStatus.platform || 'unknown',
          req.get('user-agent') || 'unknown'
        ]
      );
    } else {
      // Update last active time
      await db.query(
        `UPDATE app_installations
         SET last_active = CURRENT_TIMESTAMP, app_version = $2
         WHERE its_id = $1 AND DATE(installed_at) = $3`,
        [itsId, version, today]
      );
    }

    res.json({ success: true, message: 'Installation tracked' });
  } catch (err) {
    console.error('Error tracking installation:', err);
    res.status(500).json({ error: 'Failed to track installation' });
  }
});

// GET /api/app-analytics/stats - Get installation statistics (admin only)
router.get('/stats', async (req, res) => {
  try {
    // Get total installations today
    const todayResult = await db.query(
      `SELECT COUNT(DISTINCT its_id) as count
       FROM app_installations
       WHERE DATE(installed_at) = CURRENT_DATE`
    );

    // Get total unique installations ever
    const totalResult = await db.query(
      `SELECT COUNT(DISTINCT its_id) as count
       FROM app_installations`
    );

    // Get top versions
    const versionsResult = await db.query(
      `SELECT app_version, COUNT(*) as count
       FROM app_installations
       WHERE DATE(installed_at) >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY app_version
       ORDER BY count DESC
       LIMIT 5`
    );

    // Get installation methods
    const methodsResult = await db.query(
      `SELECT detection_method, COUNT(*) as count
       FROM app_installations
       WHERE DATE(installed_at) >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY detection_method
       ORDER BY count DESC`
    );

    // Get active users (last 24 hours)
    const activeResult = await db.query(
      `SELECT COUNT(DISTINCT its_id) as count
       FROM app_installations
       WHERE last_active >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`
    );

    res.json({
      installationsToday: todayResult.rows[0]?.count || 0,
      totalInstallations: totalResult.rows[0]?.count || 0,
      activeUsers24h: activeResult.rows[0]?.count || 0,
      topVersions: versionsResult.rows,
      installationMethods: methodsResult.rows
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/app-analytics/user/:itsId - Get user installation history (private)
router.get('/user/:itsId', async (req, res) => {
  try {
    const { itsId } = req.params;

    const result = await db.query(
      `SELECT app_version, detection_method, platform, installed_at, last_active
       FROM app_installations
       WHERE its_id = $1
       ORDER BY installed_at DESC
       LIMIT 10`,
      [itsId]
    );

    res.json({
      itsId,
      installations: result.rows
    });
  } catch (err) {
    console.error('Error fetching user installations:', err);
    res.status(500).json({ error: 'Failed to fetch user installations' });
  }
});

module.exports = router;
