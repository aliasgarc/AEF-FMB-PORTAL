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
// OPTIMIZED: All queries run in parallel to minimize latency (especially on mobile)
router.get('/stats', async (req, res) => {
  try {
    // Run all 5 queries in parallel instead of sequentially
    const [todayRes, totalRes, versionsRes, methodsRes, activeRes] = await Promise.all([
      // Today's installations
      db.query(`
        SELECT COUNT(DISTINCT its_id) as count
        FROM app_installations
        WHERE DATE(installed_at) = CURRENT_DATE
      `),
      // Total installations ever
      db.query(`
        SELECT COUNT(DISTINCT its_id) as count
        FROM app_installations
      `),
      // Top versions (30-day window)
      db.query(`
        SELECT app_version, COUNT(*) as count
        FROM app_installations
        WHERE DATE(installed_at) >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY app_version
        ORDER BY count DESC
        LIMIT 5
      `),
      // Installation methods (7-day window)
      db.query(`
        SELECT detection_method, COUNT(*) as count
        FROM app_installations
        WHERE DATE(installed_at) >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY detection_method
        ORDER BY count DESC
      `),
      // Active users (24-hour window)
      db.query(`
        SELECT COUNT(DISTINCT its_id) as count
        FROM app_installations
        WHERE last_active >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `)
    ]);

    res.json({
      installationsToday: todayRes.rows[0]?.count || 0,
      totalInstallations: totalRes.rows[0]?.count || 0,
      activeUsers24h: activeRes.rows[0]?.count || 0,
      topVersions: versionsRes.rows,
      installationMethods: methodsRes.rows
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

// GET /api/app-analytics/export/csv - Export analytics as CSV
router.get('/export/csv', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let whereClause = '';
    let params = [];

    if (startDate || endDate) {
      whereClause = ' WHERE';
      if (startDate) {
        whereClause += ` installed_at >= $${params.length + 1}`;
        params.push(startDate);
      }
      if (endDate) {
        if (startDate) whereClause += ' AND';
        whereClause += ` installed_at <= $${params.length + 1}`;
        params.push(endDate);
      }
    }

    const result = await db.query(
      `SELECT its_id, app_version, detection_method, platform, installed_at, last_active
       FROM app_installations${whereClause}
       ORDER BY installed_at DESC`,
      params
    );

    // Build CSV content
    let csv = 'ITS ID,Version,Detection Method,Platform,Installed At,Last Active\n';
    result.rows.forEach(row => {
      csv += `"${row.its_id}","${row.app_version}","${row.detection_method || ''}","${row.platform || ''}","${row.installed_at}","${row.last_active}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="pwa-analytics-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Error exporting CSV:', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// GET /api/app-analytics/report - Get detailed report with date filtering
router.get('/report', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'version' } = req.query;

    let whereClause = '';
    let params = [];

    if (startDate || endDate) {
      whereClause = ' WHERE';
      if (startDate) {
        whereClause += ` installed_at >= $${params.length + 1}`;
        params.push(startDate);
      }
      if (endDate) {
        if (startDate) whereClause += ' AND';
        whereClause += ` installed_at <= $${params.length + 1}`;
        params.push(endDate);
      }
    }

    // Get summary stats
    const summaryResult = await db.query(
      `SELECT
        COUNT(*) as total_installs,
        COUNT(DISTINCT its_id) as unique_users,
        COUNT(DISTINCT DATE(installed_at)) as days_with_installs
       FROM app_installations${whereClause}`,
      params
    );

    // Get grouped data
    const groupedResult = await db.query(
      `SELECT ${groupBy} as category, COUNT(*) as count
       FROM app_installations${whereClause}
       GROUP BY ${groupBy}
       ORDER BY count DESC`,
      params
    );

    // Get daily trend
    const trendResult = await db.query(
      `SELECT DATE(installed_at) as date, COUNT(*) as count
       FROM app_installations${whereClause}
       GROUP BY DATE(installed_at)
       ORDER BY date DESC
       LIMIT 30`,
      params
    );

    res.json({
      summary: summaryResult.rows[0],
      grouped: groupedResult.rows,
      trend: trendResult.rows,
      dateRange: {
        startDate: startDate || 'all-time',
        endDate: endDate || 'today'
      }
    });
  } catch (err) {
    console.error('Error fetching report:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

module.exports = router;
