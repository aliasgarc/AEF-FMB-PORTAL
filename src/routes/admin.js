const express = require('express');
const multer = require('multer');
const db = require('../db');
const { verifyAdminCredentials, issueToken, setAuthCookie, clearAuthCookie, requireAdmin } = require('../auth');
const { parseCombinedExcel } = require('../utils/parsers');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
// ---------------------------------------------------------------
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Get total users count
    const usersResult = await db.query(`
      SELECT COALESCE(COUNT(*), 0) AS total_users FROM fmb_its_tbl
    `);

    // Get count of users with takhmeen data
    const usersWithTakhmeen = await db.query(`
      SELECT COALESCE(COUNT(DISTINCT hof_its), 0) AS users_with_takhmeen FROM fmb_takhmeen
    `);

    // Get total Takhmeen from all records (sum of all takhmeen_amt)
    const takhmeeResult = await db.query(`
      SELECT COALESCE(SUM(CAST(NULLIF(takhmeen_amt, '') AS NUMERIC(12,2))), 0)::numeric(12,2) AS total_billed
      FROM fmb_takhmeen
      WHERE takhmeen_amt IS NOT NULL AND takhmeen_amt != ''
    `);

    // Get payment receipts stats
    const receiptsResult = await db.query(`
      SELECT
        COALESCE(SUM(amt_rcv), 0)::numeric(12,2) AS total_received,
        COALESCE(SUM(amt_pending), 0)::numeric(12,2) AS total_pending
      FROM fmb_payment_tbl
    `);

    const users = usersResult.rows[0];
    const takhmeenUsers = usersWithTakhmeen.rows[0];
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
// ---------------------------------------------------------------
router.get('/users', requireAdmin, async (req, res) => {
  try {
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
      GROUP BY u.id, u.its_id, u.sabil_no, u.name, u.mobile, u.email, u.city, u.sector, t.takhmeen_amt, t.previous_amount_due
      ORDER BY COALESCE(CAST(t.takhmeen_amt AS NUMERIC(12,2)), 0) DESC, COALESCE(SUM(pt.amt_rcv), 0) DESC, COALESCE(SUM(pt.amt_pending), 0) DESC, outstanding DESC
    `);
    res.json({ users: result.rows });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// ---------------------------------------------------------------
// GET /api/admin/users/:id — one user's demographics + full history
// ---------------------------------------------------------------
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const userResult = await db.query('SELECT * FROM fmb_its_tbl WHERE id = $1', [req.params.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    // Fetch takhmeen data from fmb_takhmeen (same as user page)
    const takhmeeResult = await db.query(
      'SELECT id, takhmeen_yr, takhmeen_amt, comment, created_at, updated_at, COALESCE(CAST(previous_amount_due AS NUMERIC(12,2)), 0)::numeric(12,2) AS previous_amount_due FROM fmb_takhmeen WHERE hof_its = $1 ORDER BY takhmeen_yr DESC',
      [userResult.rows[0].its_id]
    );

    // Fetch payment receipts (hof_its stores numeric ITS ID)
    const paymentsResult = await db.query(
      'SELECT receipt_no, amt_rcv, amt_pending, payment_mode, received_date, payment_refrence, mobile_no FROM fmb_payment_tbl WHERE hof_its = CAST($1 AS INTEGER) ORDER BY received_date DESC',
      [userResult.rows[0].its_id]
    );

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
      LIMIT 1000
    `);
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
