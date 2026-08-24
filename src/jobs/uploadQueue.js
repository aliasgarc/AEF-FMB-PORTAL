const db = require('../db');
const { parseCombinedExcel } = require('../utils/parsers');

const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Create a new upload job
async function createUploadJob(fileBuffer, adminUsername) {
  const result = await db.query(
    `INSERT INTO upload_jobs (file_data, admin_username, status)
     VALUES ($1, $2, $3)
     RETURNING id, status, created_at`,
    [fileBuffer, adminUsername, JOB_STATUS.PENDING]
  );
  return result.rows[0];
}

// Get job status
async function getJobStatus(jobId) {
  const result = await db.query(
    'SELECT * FROM upload_jobs WHERE id = $1',
    [jobId]
  );
  return result.rows[0] || null;
}

// Process a single job
async function processJob(jobId) {
  const job = await getJobStatus(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (job.status !== JOB_STATUS.PENDING) {
    throw new Error(`Job ${jobId} is already ${job.status}`);
  }

  // Mark as processing
  await db.query(
    'UPDATE upload_jobs SET status = $1, started_at = NOW() WHERE id = $2',
    [JOB_STATUS.PROCESSING, jobId]
  );

  try {
    const { rows, errors: parseErrors } = parseCombinedExcel(job.file_data);

    if (rows.length === 0) {
      throw new Error('No valid rows found in the sheet');
    }

    const client = await db.pool.connect();
    let itsUpserted = 0;
    let takhmeenUpserted = 0;
    let paymentUpserted = 0;
    const errors = [...parseErrors];
    const receivedDate = new Date().toISOString().split('T')[0];

    try {
      await client.query('BEGIN');

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const spName = `row_${row._rowNum}`;

        try {
          // Create savepoint for this row
          await client.query(`SAVEPOINT ${spName}`);

          // Update progress every 10 rows or at start
          if (rowIndex % 10 === 0 || rowIndex === 0) {
            const progress = Math.round((rowIndex / rows.length) * 100);
            await db.query(
              'UPDATE upload_jobs SET progress = $1 WHERE id = $2',
              [progress, jobId]
            );
          }

          // Step 1: Upsert into fmb_its_tbl
          const existingIts = await client.query(
            'SELECT id FROM fmb_its_tbl WHERE its_id = $1 OR its_id = $2',
            [row.its_id, parseInt(row.its_id, 10)]
          );

          let itsRecordId;
          if (existingIts.rows.length > 0) {
            itsRecordId = existingIts.rows[0].id;
            await client.query(
              `UPDATE fmb_its_tbl SET
                 sabil_no = COALESCE($2, sabil_no),
                 name = COALESCE($3, name),
                 sector = COALESCE($4, sector)
               WHERE id = $1`,
              [itsRecordId, row.sabeel_number, row.full_name, row.mohalla_name]
            );
          } else {
            const insertResult = await client.query(
              `INSERT INTO fmb_its_tbl (its_id, sabil_no, name, sector)
               VALUES ($1, $2, $3, $4)
               RETURNING id`,
              [row.its_id, row.sabeel_number, row.full_name, row.mohalla_name]
            );
            itsRecordId = insertResult.rows[0].id;
          }
          itsUpserted++;

          // Step 2: Upsert into fmb_takhmeen
          const existingTakhmeen = await client.query(
            'SELECT id FROM fmb_takhmeen WHERE hof_its = $1',
            [itsRecordId]
          );

          if (existingTakhmeen.rows.length > 0) {
            await client.query(
              `UPDATE fmb_takhmeen SET
                 takhmeen_yr = COALESCE($2, takhmeen_yr),
                 takhmeen_amt = COALESCE($3::TEXT, takhmeen_amt),
                 previous_amount_due = COALESCE($4, previous_amount_due)
               WHERE hof_its = $1`,
              [itsRecordId, row.takhmeen_year, row.takhmeen_amount, row.previous_amount]
            );
          } else {
            await client.query(
              `INSERT INTO fmb_takhmeen (hof_its, takhmeen_yr, takhmeen_amt, previous_amount_due)
               VALUES ($1, $2, $3::TEXT, $4)`,
              [itsRecordId, row.takhmeen_year, row.takhmeen_amount, row.previous_amount]
            );
          }
          takhmeenUpserted++;

          // Step 3: Upsert into fmb_payment_tbl
          const existingPayment = await client.query(
            'SELECT payment_id FROM fmb_payment_tbl WHERE hof_its = $1',
            [itsRecordId]
          );

          if (existingPayment.rows.length > 0) {
            await client.query(
              `UPDATE fmb_payment_tbl SET
                 hof_name = COALESCE($2, hof_name),
                 amt_rcv = COALESCE($3, amt_rcv),
                 amt_pending = COALESCE($4, amt_pending)
               WHERE hof_its = $1`,
              [itsRecordId, row.full_name, row.paid, row.due]
            );
          } else {
            // Generate shorter receipt number (max 20 chars): RCP-HASH-ID
            const shortHash = Math.random().toString(36).substring(2, 7).toUpperCase();
            const lastDigits = String(row.its_id).slice(-4);
            const receiptNo = `RCP-${shortHash}-${lastDigits}`;
            await client.query(
              `INSERT INTO fmb_payment_tbl (receipt_no, hof_its, hof_name, amt_rcv, payment_mode, received_date, amt_pending)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [receiptNo, itsRecordId, row.full_name, row.paid, 'N/A', receivedDate, row.due]
            );
          }
          paymentUpserted++;

          // Row succeeded, release savepoint
          await client.query(`RELEASE SAVEPOINT ${spName}`);
        } catch (rowErr) {
          // Rollback to savepoint
          await client.query(`ROLLBACK TO SAVEPOINT ${spName}`);
          errors.push(`Row ${row._rowNum} (ITS ${row.its_id}): ${rowErr.message}`);
        }
      }

      await client.query('COMMIT');

      // Mark job as completed with 100% progress
      await db.query(
        `UPDATE upload_jobs
         SET status = $1, completed_at = NOW(),
             progress = 100,
             summary = $2
         WHERE id = $3`,
        [JOB_STATUS.COMPLETED, JSON.stringify({
          recordsProcessed: rows.length,
          itsUpserted,
          takhmeenUpserted,
          paymentUpserted,
          rowErrors: errors.length - parseErrors.length,
          warnings: errors
        }), jobId]
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`Job ${jobId} failed:`, err);
    await db.query(
      `UPDATE upload_jobs
       SET status = $1, completed_at = NOW(), error_message = $2
       WHERE id = $3`,
      [JOB_STATUS.FAILED, err.message, jobId]
    );
  }
}

// Start the background worker
function startWorker(interval = 1000) {
  setInterval(async () => {
    try {
      const result = await db.query(
        `SELECT id FROM upload_jobs
         WHERE status = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [JOB_STATUS.PENDING]
      );

      if (result.rows.length > 0) {
        const jobId = result.rows[0].id;
        console.log(`Processing job ${jobId}...`);
        await processJob(jobId);
        console.log(`Job ${jobId} completed`);
      }
    } catch (err) {
      console.error('Worker error:', err);
    }
  }, interval);
}

module.exports = {
  JOB_STATUS,
  createUploadJob,
  getJobStatus,
  processJob,
  startWorker
};
