const express = require('express');
const multer = require('multer');
const db = require('../db');
const config = require('../config/config');
const { verifyAdminCredentials, issueToken, setAuthCookie, clearAuthCookie, requireAdmin } = require('../auth');
const { parseCombinedExcel } = require('../utils/parsers');

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
      LEFT JOIN fmb_payment_tbl pt ON pt.hof_its = CAST(u.its_id AS INTEGER)
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
      LEFT JOIN fmb_payment_tbl pt ON pt.hof_its = CAST(u.its_id AS INTEGER)
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
        'SELECT receipt_no, amt_rcv, amt_pending, payment_mode, received_date, payment_refrence, mobile_no FROM fmb_payment_tbl WHERE hof_its = CAST($1 AS INTEGER) ORDER BY received_date DESC',
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
// POST /api/admin/upload-combined — Combined ITS/Takhmeen/Payment upload
// ---------------------------------------------------------------
router.post('/upload-combined', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Field name must be "file".' });

  const { rows, errors: parseErrors } = parseCombinedExcel(req.file.buffer);
  if (rows.length === 0) {
    return res.status(400).json({ error: 'No valid rows found in the sheet.', details: parseErrors });
  }

  const client = await db.pool.connect();
  let itsUpserted = 0;
  let takhmeenUpserted = 0;
  let paymentUpserted = 0;
  const errors = [...parseErrors];

  const toDateString = () => new Date().toISOString().split('T')[0];
  const receivedDate = toDateString();

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      const spName = `row_${row._rowNum}`;

      try {
        // Create a savepoint for this row so we can recover if it fails
        await client.query(`SAVEPOINT ${spName}`);

        // Step 1: Upsert into fmb_its_tbl
        const existingIts = await client.query(
          'SELECT id FROM fmb_its_tbl WHERE its_id = $1',
          [row.its_id]
        );

        if (existingIts.rows.length > 0) {
          // Update existing user
          await client.query(
            `UPDATE fmb_its_tbl SET
               sabil_no = COALESCE($2, sabil_no),
               name = COALESCE($3, name),
               sector = COALESCE($4, sector)
             WHERE its_id = $1`,
            [row.its_id, row.sabeel_number, row.full_name, row.mohalla_name]
          );
        } else {
          // Insert new user
          await client.query(
            `INSERT INTO fmb_its_tbl (its_id, sabil_no, name, sector)
             VALUES ($1, $2, $3, $4)`,
            [row.its_id, row.sabeel_number, row.full_name, row.mohalla_name]
          );
        }
        itsUpserted++;

        // Step 2: Upsert into fmb_takhmeen
        const existingTakhmeen = await client.query(
          'SELECT id FROM fmb_takhmeen WHERE hof_its = $1',
          [row.its_id]
        );

        if (existingTakhmeen.rows.length > 0) {
          // Update existing takhmeen record
          await client.query(
            `UPDATE fmb_takhmeen SET
               takhmeen_yr = COALESCE($2, takhmeen_yr),
               takhmeen_amt = COALESCE($3::TEXT, takhmeen_amt),
               previous_amount_due = COALESCE($4, previous_amount_due)
             WHERE hof_its = $1`,
            [row.its_id, row.takhmeen_year, row.takhmeen_amount, row.previous_amount]
          );
        } else {
          // Insert new takhmeen record
          await client.query(
            `INSERT INTO fmb_takhmeen (hof_its, takhmeen_yr, takhmeen_amt, previous_amount_due)
             VALUES ($1, $2, $3::TEXT, $4)`,
            [row.its_id, row.takhmeen_year, row.takhmeen_amount, row.previous_amount]
          );
        }
        takhmeenUpserted++;

        // Step 3: Upsert into fmb_payment_tbl
        const existingPayment = await client.query(
          'SELECT payment_id FROM fmb_payment_tbl WHERE hof_its = $1',
          [row.its_id]
        );

        if (existingPayment.rows.length > 0) {
          // Update existing payment record
          await client.query(
            `UPDATE fmb_payment_tbl SET
               hof_name = COALESCE($2, hof_name),
               amt_rcv = COALESCE($3, amt_rcv),
               amt_pending = COALESCE($4, amt_pending)
             WHERE hof_its = $1`,
            [row.its_id, row.full_name, row.paid, row.due]
          );
        } else {
          // Insert new payment record with auto-generated receipt_no
          const receiptNo = `RCP-${row.its_id}-${Date.now()}`;
          await client.query(
            `INSERT INTO fmb_payment_tbl (receipt_no, hof_its, hof_name, amt_rcv, payment_mode, received_date, amt_pending)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [receiptNo, row.its_id, row.full_name, row.paid, 'N/A', receivedDate, row.due]
          );
        }
        paymentUpserted++;

        // Row succeeded, release savepoint
        await client.query(`RELEASE SAVEPOINT ${spName}`);
      } catch (rowErr) {
        // Rollback to savepoint to recover from this row's error
        await client.query(`ROLLBACK TO SAVEPOINT ${spName}`);
        errors.push(`Row ${row._rowNum} (ITS ${row.its_id}): ${rowErr.message}`);
      }
    }

    await client.query('COMMIT');

    res.json({
      ok: true,
      summary: {
        recordsProcessed: rows.length,
        itsUpserted,
        takhmeenUpserted,
        paymentUpserted,
        rowErrors: errors.length - parseErrors.length
      },
      warnings: errors
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Combined upload error:', err);
    res.status(500).json({ error: 'Failed to process combined upload.', details: err.message });
  } finally {
    client.release();
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
      LEFT JOIN fmb_its_tbl u ON p.hof_its = CAST(u.its_id AS INTEGER)
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
      `SELECT * FROM fmb_payment_tbl WHERE hof_its = CAST($1 AS INTEGER) ORDER BY created_at DESC`,
      [req.params.hofIts]
    );
    res.json({ payments: result.rows });
  } catch (err) {
    console.error('Payment history error:', err);
    res.status(500).json({ error: 'Failed to fetch payment history.' });
  }
});

module.exports = router;
