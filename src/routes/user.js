const express = require('express');
const db = require('../db');

const router = express.Router();

// ---------------------------------------------------------------
// GET /api/user/:itsId — public lookup, no auth.
// Returns demographic details + Takhmeen contribution history + outstanding dues.
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

    // Fetch Takhmeen contribution data from fmb_takhmeen table
    const takhmeeResult = await db.query(
      'SELECT id, takhmeen_yr, takhmeen_amt, comment FROM fmb_takhmeen WHERE hof_its = $1 ORDER BY takhmeen_yr DESC',
      [itsId]
    );

    // Fetch payment receipts (actual payments received)
    const paymentsResult = await db.query(
      'SELECT receipt_no, amt_rcv, amt_pending, payment_mode, received_date, payment_refrence, mobile_no FROM fmb_payment_tbl WHERE hof_its = CAST($1 AS INTEGER) ORDER BY received_date DESC',
      [itsId]
    );

    const takhmeen = takhmeeResult.rows;
    const payments = paymentsResult.rows;

    // Calculate totals from fmb_takhmeen (source of truth for Takhmeen contributions)
    const totalBilled = takhmeen.reduce((sum, t) => sum + Number(t.takhmeen_amt || 0), 0);

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
      takhmeen,
      payments,
      summary: {
        totalBilled,
        outstanding: totalBilled - totalReceived,
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
