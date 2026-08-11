const express = require('express');
const db = require('../db');

const router = express.Router();

// ---------------------------------------------------------------
// GET /api/user/:itsId — public lookup, no auth.
// Returns demographic details + payment history + outstanding dues.
// ---------------------------------------------------------------
router.get('/:itsId', async (req, res) => {
  const itsId = String(req.params.itsId || '').trim();
  if (!itsId) return res.status(400).json({ error: 'ITS ID is required.' });

  try {
    const userResult = await db.query('SELECT * FROM fmb_its_tbl WHERE its_id = $1', [itsId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No account found for that ITS ID.' });
    }

    const user = userResult.rows[0];
    const historyResult = await db.query(
      'SELECT period_label, amount_billed, amount_paid, due_date, status, notes, created_at FROM payment_records WHERE user_id = $1 ORDER BY created_at DESC',
      [user.id]
    );

    // Fetch payment receipts (actual payments received)
    const paymentsResult = await db.query(
      'SELECT receipt_no, amt_rcv, amt_pending, payment_mode, received_date, payment_refrence, mobile_no FROM fmb_payment_tbl WHERE hof_its = $1 ORDER BY received_date DESC',
      [user.id]
    );

    const history = historyResult.rows;
    const payments = paymentsResult.rows;

    // Calculate totals from payment_records (source of truth for billing)
    const totalBilled = history.reduce((sum, r) => sum + Number(r.amount_billed), 0);
    const totalPaid = history.reduce((sum, r) => sum + Number(r.amount_paid), 0);

    // Calculate totals from payment receipts (actual amounts received)
    const totalReceived = payments.reduce((sum, p) => sum + Number(p.amt_rcv || 0), 0);
    const totalPending = payments.reduce((sum, p) => sum + Number(p.amt_pending || 0), 0);

    res.json({
      user: {
        its_id: user.its_id,
        sabil_no: user.sabil_no,
        name: user.name,
        address: user.address,
        mobile: user.mobile,
        email: user.email,
        city: user.city,
        pincode: user.pincode,
        sector: user.sector,
        sub_sector: user.sub_sector
      },
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
    console.error('User lookup error:', err);
    res.status(500).json({ error: 'Server error looking up account.' });
  }
});

module.exports = router;
