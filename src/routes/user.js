const express = require('express');
const db = require('../db');

const router = express.Router();

// ---------------------------------------------------------------
// GET /api/user/:itsId — public lookup with fetch tracking.
// Returns demographic details + Takhmeen contribution history + outstanding dues + last update info.
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
    const userId = user.id; // Get the internal ID

    // Fetch Takhmeen contribution data from fmb_takhmeen table
    const takhmeeResult = await db.query(
      'SELECT id, takhmeen_yr, takhmeen_amt, comment, created_at, updated_at, COALESCE(CAST(previous_amount_due AS NUMERIC(12,2)), 0)::numeric(12,2) AS previous_amount_due FROM fmb_takhmeen WHERE hof_its = $1 ORDER BY takhmeen_yr DESC',
      [userId]
    );

    // Fetch payment receipts (actual payments received)
    const paymentsResult = await db.query(
      'SELECT receipt_no, amt_rcv, amt_pending, payment_mode, received_date, payment_refrence, mobile_no, created_at, updated_at FROM fmb_payment_tbl WHERE hof_its = $1 ORDER BY received_date DESC',
      [userId]
    );

    const takhmeen = takhmeeResult.rows;
    const payments = paymentsResult.rows;

    // Calculate totals from fmb_takhmeen (source of truth for Takhmeen contributions)
    const totalBilled = takhmeen.reduce((sum, t) => sum + Number(t.takhmeen_amt || 0), 0);
    const totalPreviousDue = takhmeen.reduce((sum, t) => sum + Number(t.previous_amount_due || 0), 0);

    // Calculate totals from payment receipts (actual amounts received)
    const totalReceived = payments.reduce((sum, p) => sum + Number(p.amt_rcv || 0), 0);
    const totalPending = payments.reduce((sum, p) => sum + Number(p.amt_pending || 0), 0);

    // Get last update dates
    const lastPaymentUpdate = payments.length > 0
      ? (payments[0].updated_at || payments[0].created_at)
      : null;

    const lastTakhmeeUpdate = takhmeen.length > 0
      ? (takhmeen[0].updated_at || takhmeen[0].created_at)
      : null;

    // Track this user fetch (log to database)
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || 'unknown';

    try {
      await db.query(
        'INSERT INTO user_fetch_history (its_id, ip_address, user_agent) VALUES ($1, $2, $3)',
        [itsId, ipAddress, userAgent]
      );
    } catch (trackingErr) {
      // If tracking table doesn't exist, continue without tracking
      console.warn('User tracking not available:', trackingErr.message);
    }

    // Get total fetch count and last fetch time
    let fetchStats = { totalFetches: 0, lastFetch: null };
    try {
      const statsResult = await db.query(
        'SELECT COUNT(*) as total, MAX(fetched_at) as last_fetch FROM user_fetch_history WHERE its_id = $1',
        [itsId]
      );
      if (statsResult.rows.length > 0) {
        fetchStats = {
          totalFetches: parseInt(statsResult.rows[0].total || 0),
          lastFetch: statsResult.rows[0].last_fetch
        };
      }
    } catch (statsErr) {
      console.warn('Could not fetch statistics:', statsErr.message);
    }

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
        totalPreviousDue,
        outstanding: totalPreviousDue + totalBilled - totalReceived,
        totalReceived,
        totalPending
      },
      tracking: {
        lastFetch: fetchStats.lastFetch,
        lastPaymentUpdate,
        lastTakhmeeUpdate,
        totalFetches: fetchStats.totalFetches
      }
    });
  } catch (err) {
    console.error('User lookup error:', err);
    res.status(500).json({ error: 'Server error looking up account.' });
  }
});

module.exports = router;
