const express = require('express');
const multer = require('multer');
const db = require('../db');
const { verifyAdminCredentials, issueToken, setAuthCookie, clearAuthCookie, requireAdmin } = require('../auth');
const { parsePaymentExcel } = require('../utils/excelParser');
const { parsePaymentExcel: parsePaymentReceipts } = require('../utils/paymentParser');

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
// GET /api/admin/stats — dashboard statistics (billing + payments)
// ---------------------------------------------------------------
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Get billing stats from payment_records
    const billingResult = await db.query(`
      SELECT
        COALESCE(COUNT(DISTINCT u.id), 0) AS total_users,
        COALESCE(SUM(p.amount_billed), 0)::numeric(12,2) AS total_billed,
        COALESCE(SUM(p.amount_paid), 0)::numeric(12,2) AS total_paid
      FROM fmb_its_tbl u
      LEFT JOIN payment_records p ON p.user_id = u.id
    `);

    // Get payment receipts stats
    const receiptsResult = await db.query(`
      SELECT
        COALESCE(SUM(amt_rcv), 0)::numeric(12,2) AS total_received,
        COALESCE(SUM(amt_pending), 0)::numeric(12,2) AS total_pending
      FROM fmb_payment_tbl
    `);

    const billing = billingResult.rows[0];
    const receipts = receiptsResult.rows[0];

    res.json({
      users: {
        totalUsers: parseInt(billing.total_users),
        totalBilled: parseFloat(billing.total_billed),
        totalPaid: parseFloat(billing.total_paid)
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
// GET /api/admin/users — list of all users with billing + payment summary
// ---------------------------------------------------------------
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id, u.its_id, u.sabil_no, u.name, u.mobile, u.email, u.city, u.sector,
        COALESCE(SUM(p.amount_billed), 0)::numeric(12,2) AS total_billed,
        COALESCE(SUM(p.amount_paid), 0)::numeric(12,2) AS total_paid,
        (COALESCE(SUM(p.amount_billed), 0) - COALESCE(SUM(p.amount_paid), 0))::numeric(12,2) AS outstanding,
        COALESCE(SUM(pt.amt_rcv), 0)::numeric(12,2) AS amount_received,
        COALESCE(SUM(pt.amt_pending), 0)::numeric(12,2) AS amount_pending
      FROM fmb_its_tbl u
      LEFT JOIN payment_records p ON p.user_id = u.id
      LEFT JOIN fmb_payment_tbl pt ON pt.hof_its = CAST(u.its_id AS INTEGER)
      GROUP BY u.id
      ORDER BY outstanding DESC, u.name ASC
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

    const historyResult = await db.query(
      'SELECT * FROM payment_records WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    // Fetch payment receipts (hof_its stores numeric ITS ID)
    const paymentsResult = await db.query(
      'SELECT receipt_no, amt_rcv, amt_pending, payment_mode, received_date, payment_refrence, mobile_no FROM fmb_payment_tbl WHERE hof_its = CAST($1 AS INTEGER) ORDER BY received_date DESC',
      [userResult.rows[0].its_id]
    );

    const user = userResult.rows[0];
    const history = historyResult.rows;
    const payments = paymentsResult.rows;
    const totalBilled = history.reduce((sum, r) => sum + Number(r.amount_billed), 0);
    const totalPaid = history.reduce((sum, r) => sum + Number(r.amount_paid), 0);
    const totalReceived = payments.reduce((sum, p) => sum + Number(p.amt_rcv || 0), 0);
    const totalPending = payments.reduce((sum, p) => sum + Number(p.amt_pending || 0), 0);

    res.json({
      user,
      history,
      payments,
      summary: {
        totalBilled,
        totalPaid,
        outstanding: totalBilled - totalPaid,
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
// POST /api/admin/upload — Excel bulk insert/update
// ---------------------------------------------------------------
router.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Field name must be "file".' });

  const { rows, errors } = parsePaymentExcel(req.file.buffer);
  if (rows.length === 0) {
    return res.status(400).json({ error: 'No valid rows found in the sheet.', details: errors });
  }

  const client = await db.pool.connect();
  let usersUpserted = 0;
  let paymentsInserted = 0;

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      // Upsert user by its_id (primary lookup)
      // First, check if user exists by its_id
      const existingUser = await client.query(
        'SELECT id FROM fmb_its_tbl WHERE its_id = $1',
        [row.its_id]
      );

      let userId;
      if (existingUser.rows.length > 0) {
        // Update existing user
        userId = existingUser.rows[0].id;
        await client.query(
          `UPDATE fmb_its_tbl SET
             sabil_no = COALESCE($2, sabil_no),
             hof_its = COALESCE($3, hof_its),
             name = $4,
             address = COALESCE($5, address),
             mobile = COALESCE($6, mobile),
             email = COALESCE($7, email),
             city = COALESCE($8, city),
             pincode = COALESCE($9, pincode),
             sector = COALESCE($10, sector),
             sub_sector = COALESCE($11, sub_sector)
           WHERE id = $12`,
          [row.its_id, row.sabil_no, row.hof_its, row.name, row.address, row.mobile, row.email, row.city, row.pincode, row.sector, row.sub_sector, userId]
        );
      } else {
        // Insert new user
        const userResult = await client.query(
          `INSERT INTO fmb_its_tbl (its_id, sabil_no, hof_its, name, address, mobile, email, city, pincode, sector, sub_sector)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [row.its_id, row.sabil_no, row.hof_its, row.name, row.address, row.mobile, row.email, row.city, row.pincode, row.sector, row.sub_sector]
        );
        userId = userResult.rows[0].id;
      }
      usersUpserted++;

      // Insert a payment record only if the row carries billing info
      const hasBillingInfo = row.amount_billed !== 0 || row.amount_paid !== 0 || row.period_label || row.due_date;
      if (hasBillingInfo) {
        const status = row.status || (row.amount_paid >= row.amount_billed ? 'paid' : row.amount_paid > 0 ? 'partial' : 'pending');
        await client.query(
          `INSERT INTO payment_records (user_id, period_label, amount_billed, amount_paid, due_date, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [userId, row.period_label, row.amount_billed, row.amount_paid, row.due_date, status, row.notes]
        );
        paymentsInserted++;
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true, usersUpserted, paymentsInserted, warnings: errors });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to process upload.', details: err.message });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------
// POST /api/admin/upload-payments — Excel bulk insert for payments
// ---------------------------------------------------------------
router.post('/upload-payments', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Field name must be "file".' });

  const { rows, errors } = parsePaymentReceipts(req.file.buffer);
  if (rows.length === 0) {
    return res.status(400).json({ error: 'No valid payment records found in the sheet.', details: errors });
  }

  const client = await db.pool.connect();
  let paymentsInserted = 0;
  let paymentsDuplicate = 0;
  let totalReceived = 0;

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      // Check if receipt already exists
      const existingReceipt = await client.query(
        'SELECT receipt_no FROM fmb_payment_tbl WHERE receipt_no = $1',
        [row.receipt_no]
      );

      if (existingReceipt.rows.length > 0) {
        // Receipt already exists, skip it
        paymentsDuplicate++;
        errors.push(`Receipt ${row.receipt_no} already exists - skipped.`);
        continue;
      }

      // Look up user by its_id to get database id
      const userResult = await client.query(
        'SELECT id FROM fmb_its_tbl WHERE its_id = $1',
        [String(row.hof_its)]
      );

      if (userResult.rows.length === 0) {
        errors.push(`Receipt ${row.receipt_no}: User with ITS ID ${row.hof_its} not found - skipped.`);
        continue;
      }

      const userId = userResult.rows[0].id;

      // Insert payment record
      await client.query(
        `INSERT INTO fmb_payment_tbl (receipt_no, hof_its, hof_name, amt_rcv, payment_mode, received_date, amt_pending, payment_refrence, mobile_no)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [row.receipt_no, userId, row.hof_name, row.amt_rcv, row.payment_mode, row.received_date, row.amt_pending, row.payment_refrence, row.mobile_no]
      );
      paymentsInserted++;
      totalReceived += Number(row.amt_rcv);
    }

    await client.query('COMMIT');
    res.json({
      ok: true,
      paymentsInserted,
      paymentsDuplicate,
      summary: { totalReceived: totalReceived.toFixed(2), recordsProcessed: rows.length, duplicatesSkipped: paymentsDuplicate },
      warnings: errors
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Payment upload error:', err);
    res.status(500).json({ error: 'Failed to process payment upload.', details: err.message });
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
