require('dotenv').config();
const db = require('../db');

async function cleanup() {
  try {
    console.log('🔍 Identifying duplicates from recent uploads...\n');

    // Get ITS records that appear multiple times
    const dupeIts = await db.query(`
      SELECT hof_its
      FROM fmb_takhmeen
      GROUP BY hof_its
      HAVING COUNT(*) > 1
    `);

    if (dupeIts.rows.length === 0) {
      console.log('✅ No duplicates found!');
      process.exit(0);
    }

    console.log(`Found ${dupeIts.rows.length} ITS with duplicates\n`);

    // For each duplicate ITS, keep only the first takhmeen record and delete the rest
    console.log('🗑️  Removing duplicate takhmeen records...\n');

    let deletedTakhmeen = 0;
    for (const row of dupeIts.rows) {
      // Keep the oldest record, delete newer ones
      const result = await db.query(`
        DELETE FROM fmb_takhmeen
        WHERE hof_its = $1
        AND id NOT IN (
          SELECT id FROM fmb_takhmeen
          WHERE hof_its = $1
          ORDER BY id ASC
          LIMIT 1
        )
      `, [row.hof_its]);

      deletedTakhmeen += result.rowCount;
    }

    console.log(`✅ Deleted ${deletedTakhmeen} duplicate takhmeen records\n`);

    // Also clean up payment duplicates if any
    console.log('🗑️  Removing duplicate payment records...\n');
    const dupePayments = await db.query(`
      SELECT hof_its
      FROM fmb_payment_tbl
      GROUP BY hof_its
      HAVING COUNT(*) > 1
    `);

    let deletedPayments = 0;
    for (const row of dupePayments.rows) {
      const result = await db.query(`
        DELETE FROM fmb_payment_tbl
        WHERE hof_its = $1
        AND payment_id NOT IN (
          SELECT payment_id FROM fmb_payment_tbl
          WHERE hof_its = $1
          ORDER BY payment_id ASC
          LIMIT 1
        )
      `, [row.hof_its]);

      deletedPayments += result.rowCount;
    }

    console.log(`✅ Deleted ${deletedPayments} duplicate payment records\n`);

    // Show new totals
    console.log('=== UPDATED TOTALS ===\n');
    const totals = await db.query(`
      SELECT
        COUNT(*) as row_count,
        SUM(takhmeen_amt::numeric) as total_takhmeen,
        SUM(previous_amount_due::numeric) as total_previous_due
      FROM fmb_takhmeen
    `);
    console.log(`Takhmeen table: ${totals.rows[0].row_count} rows`);
    console.log(`  Total Takhmeen: ₹${Number(totals.rows[0].total_takhmeen).toLocaleString('en-IN')}`);

    const paymentTotals = await db.query(`
      SELECT
        COUNT(DISTINCT hof_its) as unique_its,
        SUM(amt_rcv::numeric) as total_paid,
        SUM(amt_pending::numeric) as total_pending
      FROM fmb_payment_tbl
    `);
    console.log(`  Total Paid: ₹${Number(paymentTotals.rows[0].total_paid).toLocaleString('en-IN')}`);
    console.log(`  Total Pending: ₹${Number(paymentTotals.rows[0].total_pending).toLocaleString('en-IN')}`);

    console.log('\n✅ Cleanup complete! Duplicates removed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

cleanup();
