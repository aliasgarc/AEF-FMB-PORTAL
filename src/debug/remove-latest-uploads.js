require('dotenv').config();
const db = require('../db');

async function cleanup() {
  try {
    console.log('🗑️  Removing data from Jobs 8 & 9 (latest duplicate uploads)...\n');

    // Get the admin usernames for jobs 8 and 9
    const jobs = await db.query(`
      SELECT id, admin_username, created_at
      FROM upload_jobs
      WHERE id IN (8, 9)
      ORDER BY id
    `);

    console.log('Jobs to remove:');
    jobs.rows.forEach(row => {
      console.log(`  Job ${row.id}: ${row.admin_username} - ${row.created_at}`);
    });

    // Since we can't easily track which records belong to which job (no job_id in data tables),
    // we'll delete the OLDEST records for each ITS that has duplicates
    // Keep the records from job 2 (first successful upload)

    console.log('\nStrategy: Keep oldest records, remove newest duplicates\n');

    // Get all takhmeen records sorted by ID
    const takhmeenData = await db.query(`
      SELECT id, hof_its, takhmeen_amt::numeric as amt
      FROM fmb_takhmeen
      ORDER BY hof_its, id
    `);

    console.log(`Total takhmeen records: ${takhmeenData.rows.length}`);

    // Group by hof_its and find duplicates
    const itsMap = {};
    takhmeenData.rows.forEach(row => {
      if (!itsMap[row.hof_its]) {
        itsMap[row.hof_its] = [];
      }
      itsMap[row.hof_its].push(row.id);
    });

    let toDelete = [];
    Object.entries(itsMap).forEach(([its, ids]) => {
      if (ids.length > 1) {
        // Keep first, delete rest
        console.log(`ITS ${its}: ${ids.length} records - keeping ID ${ids[0]}, deleting ${ids.slice(1)}`);
        toDelete.push(...ids.slice(1));
      }
    });

    if (toDelete.length === 0) {
      console.log('No duplicates found');
      process.exit(0);
    }

    console.log(`\nDeleting ${toDelete.length} takhmeen records...\n`);

    // Delete takhmeen duplicates
    const tResult = await db.query(
      `DELETE FROM fmb_takhmeen WHERE id = ANY($1)`,
      [toDelete]
    );
    console.log(`✅ Deleted ${tResult.rowCount} takhmeen records`);

    // Also delete corresponding payment duplicates
    // For each deleted takhmeen, we need to keep only one payment per ITS
    const paymentDeleteIds = [];
    const paymentData = await db.query(`
      SELECT payment_id, hof_its
      FROM fmb_payment_tbl
      ORDER BY hof_its, payment_id
    `);

    const paymentMap = {};
    paymentData.rows.forEach(row => {
      if (!paymentMap[row.hof_its]) {
        paymentMap[row.hof_its] = [];
      }
      paymentMap[row.hof_its].push(row.payment_id);
    });

    Object.entries(paymentMap).forEach(([its, ids]) => {
      if (ids.length > 1) {
        paymentDeleteIds.push(...ids.slice(1));
      }
    });

    if (paymentDeleteIds.length > 0) {
      const pResult = await db.query(
        `DELETE FROM fmb_payment_tbl WHERE payment_id = ANY($1)`,
        [paymentDeleteIds]
      );
      console.log(`✅ Deleted ${pResult.rowCount} payment records`);
    }

    // Show new totals
    console.log('\n=== NEW TOTALS ===\n');
    const totals = await db.query(`
      SELECT
        COUNT(*) as row_count,
        SUM(takhmeen_amt::numeric) as total_takhmeen
      FROM fmb_takhmeen
    `);
    console.log(`Takhmeen: ${totals.rows[0].row_count} rows`);
    console.log(`Total: ₹${Number(totals.rows[0].total_takhmeen).toLocaleString('en-IN')}`);

    const payments = await db.query(`
      SELECT
        SUM(amt_rcv::numeric) as total_paid,
        SUM(amt_pending::numeric) as total_pending
      FROM fmb_payment_tbl
    `);
    console.log(`\nPayments:`);
    console.log(`Total Paid: ₹${Number(payments.rows[0].total_paid).toLocaleString('en-IN')}`);
    console.log(`Total Pending: ₹${Number(payments.rows[0].total_pending).toLocaleString('en-IN')}`);

    console.log('\n✅ Cleanup complete! Ready to verify on dashboard.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

cleanup();
