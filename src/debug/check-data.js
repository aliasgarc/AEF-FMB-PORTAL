require('dotenv').config();
const db = require('../db');

async function check() {
  try {
    console.log('=== CHECKING FOR DUPLICATES ===\n');

    // 1. Check if we have multiple takhmeen records per ITS
    const dupeCheck = await db.query(`
      SELECT hof_its, COUNT(*) as cnt, array_agg(id) as ids
      FROM fmb_takhmeen
      GROUP BY hof_its
      HAVING COUNT(*) > 1
      LIMIT 10
    `);

    if (dupeCheck.rows.length > 0) {
      console.log(`⚠️  Found ${dupeCheck.rows.length} ITS with multiple takhmeen records:`);
      dupeCheck.rows.forEach(row => {
        console.log(`  • ITS ${row.hof_its}: ${row.cnt} records (IDs: ${row.ids})`);
      });
    } else {
      console.log('✅ No duplicate takhmeen records per ITS');
    }

    // 2. Check total amounts
    console.log('\n=== TOTALS ===');
    const totals = await db.query(`
      SELECT
        COUNT(*) as row_count,
        SUM(takhmeen_amt::numeric) as total_takhmeen,
        SUM(previous_amount_due::numeric) as total_previous_due
      FROM fmb_takhmeen
    `);
    console.log(`Takhmeen table: ${totals.rows[0].row_count} rows`);
    console.log(`  Total Takhmeen: ₹${Number(totals.rows[0].total_takhmeen).toLocaleString('en-IN')}`);
    console.log(`  Total Previous Due: ₹${Number(totals.rows[0].total_previous_due).toLocaleString('en-IN')}`);

    // 3. Check payment totals
    console.log('\n=== PAYMENT TOTALS ===');
    const paymentTotals = await db.query(`
      SELECT
        COUNT(DISTINCT hof_its) as unique_its,
        COUNT(*) as total_rows,
        SUM(amt_rcv::numeric) as total_paid,
        SUM(amt_pending::numeric) as total_pending
      FROM fmb_payment_tbl
    `);
    console.log(`Payment table: ${paymentTotals.rows[0].total_rows} rows (${paymentTotals.rows[0].unique_its} unique ITS)`);
    console.log(`  Total Paid: ₹${Number(paymentTotals.rows[0].total_paid).toLocaleString('en-IN')}`);
    console.log(`  Total Pending: ₹${Number(paymentTotals.rows[0].total_pending).toLocaleString('en-IN')}`);

    // 4. Check upload jobs
    console.log('\n=== UPLOAD JOBS ===');
    const jobs = await db.query(`
      SELECT id, status, progress, created_at
      FROM upload_jobs
      ORDER BY id DESC
      LIMIT 5
    `);
    jobs.rows.forEach(row => {
      console.log(`Job ${row.id}: ${row.status} (${row.progress}%) - ${row.created_at}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

check();
