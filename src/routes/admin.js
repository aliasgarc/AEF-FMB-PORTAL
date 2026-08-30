const express = require('express');
const multer = require('multer');
const db = require('../db');
const config = require('../config/config');
const { verifyAdminCredentials, issueToken, setAuthCookie, clearAuthCookie, requireAdmin } = require('../auth');
const { parseCombinedExcel } = require('../utils/parsers');
const { createUploadJob, getJobStatus } = require('../jobs/uploadQueue');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.MAX_FILE_SIZE } });

// ---------------------------------------------------------------
// POST /api/admin/login
// ---------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const admin = await verifyAdminCredentials(username, password);
    if (!admin) return res.status(401).json({ error: 'Invalid username or password.' });

    const token = issueToken(admin);
    setAuthCookie(res, token);
    res.json({ ok: true, admin: { username: admin.username } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// ---------------------------------------------------------------
// POST /api/admin/logout
// ---------------------------------------------------------------
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// ---------------------------------------------------------------
// GET /api/admin/me  — check current session
// ---------------------------------------------------------------
router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

// ---------------------------------------------------------------
// GET /api/admin/stats — dashboard statistics (Takhmeen + payments)
// OPTIMIZED: All 4 queries run in parallel to minimize latency
// ---------------------------------------------------------------
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Run all stats queries in parallel instead of sequentially
    const [usersResult, takhmeenUsersResult, takhmeeResult, receiptsResult] = await Promise.all([
      // Total users count
      db.query(`
        SELECT COALESCE(COUNT(*), 0) AS total_users FROM fmb_its_tbl
      `),
      // Count of users with takhmeen data
      db.query(`
        SELECT COALESCE(COUNT(DISTINCT hof_its), 0) AS users_with_takhmeen FROM fmb_takhmeen
      `),
      // Total Takhmeen from all records
      db.query(`
        SELECT COALESCE(SUM(CAST(NULLIF(takhmeen_amt, '') AS NUMERIC(12,2))), 0)::numeric(12,2) AS total_billed
        FROM fmb_takhmeen
        WHERE takhmeen_amt IS NOT NULL AND takhmeen_amt != ''
      `),
      // Payment receipts stats
      db.query(`
        SELECT
          COALESCE(SUM(amt_rcv), 0)::numeric(12,2) AS total_received,
          COALESCE(SUM(amt_pending), 0)::numeric(12,2) AS total_pending
        FROM fmb_payment_tbl
      `)
    ]);

    const users = usersResult.rows[0];
    const takhmeenUsers = takhmeenUsersResult.rows[0];
    const takhmeen = takhmeeResult.rows[0];
    const receipts = receiptsResult.rows[0];

    res.json({
      users: {
        totalUsers: parseInt(users.total_users),
        usersWithTakhmeen: parseInt(takhmeenUsers.users_with_takhmeen),
        totalBilled: parseFloat(takhmeen.total_billed),
        totalPaid: parseFloat(receipts.total_received)
      },
      receipts: {
        totalReceived: parseFloat(receipts.total_received),
        totalPending: parseFloat(receipts.total_pending)
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch statistics.' });
  }
});

// ---------------------------------------------------------------
// GET /api/admin/users — list of all users with Takhmeen + payment summary
// ENHANCED: Supports search and amount/pending percentage filtering
// Query params: search, minAmount, maxAmount, pendingScale, sortBy, sortDir
// Pending Scale: all, 0-25, 25-50, 50-75, 75-100 (percentage of pending vs billed)
// ---------------------------------------------------------------
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const {
      search = '',
      minAmount = 0,
      maxAmount = 999999999,
      pendingScale = 'all',
      sortBy = 'outstanding',
      sortDir = 'desc'
    } = req.query;

    // Build WHERE clause for filtering
    let whereConditions = [];
    let params = [];
    let paramCount = 1;

    // Search filter (ITS ID, Sabeel No, Name, Mobile, Email)
    if (search && search.trim()) {
      whereConditions.push(
        `(u.its_id ILIKE $${paramCount} OR u.sabil_no ILIKE $${paramCount} OR u.name ILIKE $${paramCount} OR u.mobile ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`
      );
      params.push(`%${search}%`);
      paramCount++;
    }

    // Amount range filter (Takhmeen amount)
    whereConditions.push(`(COALESCE(CAST(t.takhmeen_amt AS NUMERIC(12,2)), 0) >= $${paramCount})`);
    params.push(minAmount);
    paramCount++;

    whereConditions.push(`(COALESCE(CAST(t.takhmeen_amt AS NUMERIC(12,2)), 0) <= $${paramCount})`);
    params.push(maxAmount);
    paramCount++;

    // Validate sortBy to prevent SQL injection
    const validSortFields = ['outstanding', 'total_billed', 'amount_received', 'amount_pending', 'name', 'its_id', 'mobile'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'outstanding';
    const finalSortDir = sortDir.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Build HAVING clause for pending percentage filter
    let havingClause = '';
    if (pendingScale && pendingScale !== 'all') {
      const [minPercent, maxPercent] = pendingScale.split('-').map(Number);
      havingClause = `HAVING CASE
        WHEN t.takhmeen_amt IS NOT NULL AND CAST(t.takhmeen_amt AS NUMERIC(12,2)) > 0
        THEN ROUND((COALESCE(SUM(pt.amt_pending), 0) / CAST(t.takhmeen_amt AS NUMERIC(12,2))) * 100, 2)
        ELSE 0
      END >= ${minPercent}
      AND CASE
        WHEN t.takhmeen_amt IS NOT NULL AND CAST(t.takhmeen_amt AS NUMERIC(12,2)) > 0
        THEN ROUND((COALESCE(SUM(pt.amt_pending), 0) / CAST(t.takhmeen_amt AS NUMERIC(12,2))) * 100, 2)
        ELSE 0
      END <= ${maxPercent}`;
    }

    const result = await db.query(`
      SELECT
        u.id, u.its_id, u.sabil_no, u.name, u.mobile, u.email, u.city, u.sector,
        COALESCE(CAST(t.takhmeen_amt AS NUMERIC(12,2)), 0)::numeric(12,2) AS total_billed,
        COALESCE(CAST(t.previous_amount_due AS NUMERIC(12,2)), 0)::numeric(12,2) AS previous_amount_due,
        COALESCE(SUM(pt.amt_rcv), 0)::numeric(12,2) AS amount_received,
        COALESCE(SUM(pt.amt_pending), 0)::numeric(12,2) AS amount_pending,
        (COALESCE(CAST(t.previous_amount_due AS NUMERIC(12,2)), 0) + COALESCE(CAST(t.takhmeen_amt AS NUMERIC(12,2)), 0) - COALESCE(SUM(pt.amt_rcv), 0))::numeric(12,2) AS outstanding,
        -- Pending Percentage = (Amount Pending / Total Takhmeen) × 100
        CASE
          WHEN t.takhmeen_amt IS NOT NULL
            AND CAST(t.takhmeen_amt AS NUMERIC(12,2)) > 0
          THEN ROUND(
            (COALESCE(SUM(pt.amt_pending), 0) / CAST(t.takhmeen_amt AS NUMERIC(12,2))) * 100
            , 2)
          ELSE 0
        END::numeric(5,2) AS pending_percentage
      FROM fmb_its_tbl u
      LEFT JOIN fmb_takhmeen t ON t.hof_its = u.its_id
      LEFT JOIN fmb_payment_tbl pt ON pt.hof_its = u.its_id
      ${whereClause}
      GROUP BY u.id, u.its_id, u.sabil_no, u.name, u.mobile, u.email, u.city, u.sector, t.takhmeen_amt, t.previous_amount_due
      ${havingClause}
      ORDER BY ${finalSortBy} ${finalSortDir}
      LIMIT 1000
    `, params);

    res.json({ users: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// ---------------------------------------------------------------
// GET /api/admin/users/export/csv — Export filtered users as CSV
// ---------------------------------------------------------------
router.get('/users/export/csv', requireAdmin, async (req, res) => {
  try {
    const {
      search = '',
      minAmount = 0,
      maxAmount = 999999999,
      pendingScale = 'all'
    } = req.query;

    // Build WHERE clause (same as /users endpoint)
    let whereConditions = [];
    let params = [];
    let paramCount = 1;

    if (search && search.trim()) {
      whereConditions.push(
        `(u.its_id ILIKE $${paramCount} OR u.sabil_no ILIKE $${paramCount} OR u.name ILIKE $${paramCount} OR u.mobile ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`
      );
      params.push(`%${search}%`);
      paramCount++;
    }

    whereConditions.push(`(COALESCE(CAST(t.takhmeen_amt AS NUMERIC(12,2)), 0) >= $${paramCount})`);
    params.push(minAmount);
    paramCount++;

    whereConditions.push(`(COALESCE(CAST(t.takhmeen_amt AS NUMERIC(12,2)), 0) <= $${paramCount})`);
    params.push(maxAmount);
    paramCount++;

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Build HAVING clause for pending percentage filter
    let havingClause = '';
    if (pendingScale && pendingScale !== 'all') {
      const [minPercent, maxPercent] = pendingScale.split('-').map(Number);
      havingClause = `HAVING CASE
        WHEN t.takhmeen_amt IS NOT NULL AND CAST(t.takhmeen_amt AS NUMERIC(12,2)) > 0
        THEN ROUND((COALESCE(SUM(pt.amt_pending), 0) / CAST(t.takhmeen_amt AS NUMERIC(12,2))) * 100, 2)
        ELSE 0
      END >= ${minPercent}
      AND CASE
        WHEN t.takhmeen_amt IS NOT NULL AND CAST(t.takhmeen_amt AS NUMERIC(12,2)) > 0
        THEN ROUND((COALESCE(SUM(pt.amt_pending), 0) / CAST(t.takhmeen_amt AS NUMERIC(12,2))) * 100, 2)
        ELSE 0
      END <= ${maxPercent}`;
    }

    const result = await db.query(`
      SELECT
        u.id, u.its_id, u.sabil_no, u.name, u.mobile, u.email, u.city, u.sector,
        COALESCE(CAST(t.takhmeen_amt AS NUMERIC(12,2)), 0)::numeric(12,2) AS total_billed,
        COALESCE(CAST(t.previous_amount_due AS NUMERIC(12,2)), 0)::numeric(12,2) AS previous_amount_due,
        COALESCE(SUM(pt.amt_rcv), 0)::numeric(12,2) AS amount_received,
        COALESCE(SUM(pt.amt_pending), 0)::numeric(12,2) AS amount_pending,
        (COALESCE(CAST(t.previous_amount_due AS NUMERIC(12,2)), 0) + COALESCE(CAST(t.takhmeen_amt AS NUMERIC(12,2)), 0) - COALESCE(SUM(pt.amt_rcv), 0))::numeric(12,2) AS outstanding
      FROM fmb_its_tbl u
      LEFT JOIN fmb_takhmeen t ON t.hof_its = u.its_id
      LEFT JOIN fmb_payment_tbl pt ON pt.hof_its = u.its_id
      ${whereClause}
      GROUP BY u.id, u.its_id, u.sabil_no, u.name, u.mobile, u.email, u.city, u.sector, t.takhmeen_amt, t.previous_amount_due
      ${havingClause}
      ORDER BY outstanding DESC
    `, params);

    // Build CSV content
    let csv = 'ITS ID,Sabeel No,Name,Mobile,Email,City,Sector,Total Billed,Previous Due,Amount Received,Amount Pending,Outstanding\n';
    result.rows.forEach(row => {
      csv += `"${row.its_id}","${row.sabil_no || ''}","${row.name}","${row.mobile || ''}","${row.email || ''}","${row.city || ''}","${row.sector || ''}",${row.total_billed},${row.previous_amount_due},${row.amount_received},${row.amount_pending},${row.outstanding}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export users error:', err);
    res.status(500).json({ error: 'Failed to export users.' });
  }
});

// ---------------------------------------------------------------
// GET /api/admin/users/:id — one user's demographics + full history
// OPTIMIZED: Takhmeen and payment queries run in parallel
// ---------------------------------------------------------------
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const userResult = await db.query('SELECT * FROM fmb_its_tbl WHERE id = $1', [req.params.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    const itsId = userResult.rows[0].its_id;

    // Fetch takhmeen and payment data in parallel
    const [takhmeeResult, paymentsResult] = await Promise.all([
      db.query(
        'SELECT id, takhmeen_yr, takhmeen_amt, comment, created_at, updated_at, COALESCE(CAST(previous_amount_due AS NUMERIC(12,2)), 0)::numeric(12,2) AS previous_amount_due FROM fmb_takhmeen WHERE hof_its = $1 ORDER BY takhmeen_yr DESC',
        [itsId]
      ),
      db.query(
        'SELECT receipt_no, amt_rcv, amt_pending, payment_mode, received_date, payment_refrence, mobile_no FROM fmb_payment_tbl WHERE hof_its = $1 ORDER BY received_date DESC',
        [itsId]
      )
    ]);

    const user = userResult.rows[0];
    const takhmeen = takhmeeResult.rows;
    const payments = paymentsResult.rows;

    // Calculate totals from fmb_takhmeen (same as user page)
    const totalBilled = takhmeen.reduce((sum, t) => sum + Number(t.takhmeen_amt || 0), 0);
    const totalPreviousDue = takhmeen.reduce((sum, t) => sum + Number(t.previous_amount_due || 0), 0);
    const totalReceived = payments.reduce((sum, p) => sum + Number(p.amt_rcv || 0), 0);
    const totalPending = payments.reduce((sum, p) => sum + Number(p.amt_pending || 0), 0);

    res.json({
      user,
      takhmeen,
      payments,
      summary: {
        totalBilled,
        totalPreviousDue,
        outstanding: totalPreviousDue + totalBilled - totalReceived,
        totalReceived,
        totalPending
      }
    });
  } catch (err) {
    console.error('User detail error:', err);
    res.status(500).json({ error: 'Failed to fetch user detail.' });
  }
});

// ---------------------------------------------------------------
// POST /api/admin/upload-combined — Async combined upload
// File is queued for background processing
// ---------------------------------------------------------------
router.post('/upload-combined', requireAdmin, upload.single('file'), async (req, res) => {
  console.log('📨 Upload endpoint hit');

  if (!req.file) {
    console.error('❌ No file uploaded');
    return res.status(400).json({ error: 'No file uploaded. Field name must be "file".' });
  }

  try {
    console.log(`📦 Queuing upload: ${req.admin.username}, file size: ${req.file.size} bytes`);

    // Ensure res is writable
    if (res.headersSent) {
      console.error('❌ Headers already sent!');
      return;
    }

    const job = await createUploadJob(req.file.buffer, req.admin.username);
    console.log(`✅ Job ${job.id} created successfully, sending response...`);

    const response = {
      ok: true,
      jobId: job.id,
      status: job.status,
      message: 'File queued for processing. Check job status with /api/admin/upload-status/:jobId',
      checkStatusUrl: `/api/admin/upload-status/${job.id}`
    };

    console.log(`📤 Sending response:`, JSON.stringify(response));
    res.set('Content-Type', 'application/json');
    res.json(response);
    console.log(`✅ Response sent successfully`);

  } catch (err) {
    console.error('❌ Upload queue error:', err.message);
    console.error('Stack:', err.stack);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to queue upload: ' + err.message,
        type: err.constructor.name
      });
    } else {
      console.error('❌ Could not send error response - headers already sent');
    }
  }
});

// ---------------------------------------------------------------
// GET /api/admin/upload-status/:jobId — Check upload job status
// ---------------------------------------------------------------
router.get('/upload-status/:jobId', requireAdmin, async (req, res) => {
  try {
    // Disable caching for status checks - always get fresh data
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const jobId = parseInt(req.params.jobId, 10);
    const job = await getJobStatus(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    console.log(`📋 Status check for Job #${jobId}: status=${job.status}, progress=${job.progress}`);

    const response = {
      jobId: job.id,
      status: job.status,
      progress: job.progress || 0,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at
    };

    if (job.status === 'completed' && job.summary) {
      response.summary = job.summary;

      // Group errors by type for better readability
      if (response.summary.warnings && response.summary.warnings.length > 0) {
        const errorsByType = {};
        const errorsByRow = {};

        response.summary.warnings.forEach(warning => {
          // Extract error type from warning message
          const match = warning.match(/Row \d+ \(ITS \d+\): (.+)/);
          if (match) {
            const errorMsg = match[1];
            const rowMatch = warning.match(/Row (\d+)/);
            const itsMatch = warning.match(/ITS (\d+)/);

            if (!errorsByType[errorMsg]) {
              errorsByType[errorMsg] = [];
            }
            if (rowMatch && itsMatch) {
              errorsByType[errorMsg].push({ row: rowMatch[1], its: itsMatch[1] });
              errorsByRow[rowMatch[1]] = errorMsg;
            }
          }
        });

        // Add grouped errors to response
        response.summary.errorsByType = errorsByType;
        response.summary.errorDetails = {
          total: response.summary.warnings.length,
          byType: Object.entries(errorsByType).map(([error, instances]) => ({
            error,
            count: instances.length,
            affectedRows: instances.slice(0, 10).map(i => `Row ${i.row} (ITS ${i.its})`),
            moreRows: instances.length > 10 ? instances.length - 10 : 0
          }))
        };
      }
    } else if (job.status === 'failed') {
      response.error = job.error_message;
    }

    res.json(response);
  } catch (err) {
    console.error('Status check error:', err);
    res.status(500).json({ error: 'Failed to check job status.', details: err.message });
  }
});

// ---------------------------------------------------------------
// GET /api/admin/payments — list all payment receipts
// ---------------------------------------------------------------
router.get('/payments', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.payment_id, p.receipt_no, p.hof_its, p.hof_name, p.amt_rcv, p.payment_mode,
        p.received_date, p.amt_pending, p.payment_refrence, p.mobile_no, p.created_at,
        u.its_id, u.sabil_no
      FROM fmb_payment_tbl p
      LEFT JOIN fmb_its_tbl u ON p.hof_its = u.its_id
      ORDER BY p.created_at DESC
      LIMIT $1
    `, [config.PAYMENTS_LIMIT]);
    res.json({ payments: result.rows });
  } catch (err) {
    console.error('List payments error:', err);
    res.status(500).json({ error: 'Failed to fetch payments.' });
  }
});

// ---------------------------------------------------------------
// GET /api/admin/payments/:hof_its — payment history for a HOF
// ---------------------------------------------------------------
router.get('/payments/:hofIts', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM fmb_payment_tbl WHERE hof_its = $1 ORDER BY created_at DESC`,
      [req.params.hofIts]
    );
    res.json({ payments: result.rows });
  } catch (err) {
    console.error('Payment history error:', err);
    res.status(500).json({ error: 'Failed to fetch payment history.' });
  }
});

// POST /api/admin/setup-push-notifications - Initialize push notification tables
router.post('/setup-push-notifications', async (req, res) => {
  try {
    console.log('Setting up push notifications tables...');

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

    console.log('✅ Push notifications tables initialized');
    res.json({ success: true, message: 'Push notifications initialized' });
  } catch (err) {
    console.error('Error setting up push notifications:', err);
    res.status(500).json({ error: 'Failed to setup push notifications' });
  }
});

module.exports = router;
