const db = require('../db');
const { parseCombinedExcel } = require('../utils/parsers');

const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

async function createUploadJob(fileBuffer, adminUsername) {
  const result = await db.query(
    `INSERT INTO upload_jobs (file_data, admin_username, status)
     VALUES ($1, $2, $3)
     RETURNING id, status, created_at`,
    [fileBuffer, adminUsername, JOB_STATUS.PENDING]
  );
  return result.rows[0];
}

async function getJobStatus(jobId) {
  const result = await db.query('SELECT * FROM upload_jobs WHERE id = $1', [jobId]);
  return result.rows[0] || null;
}

async function processJob(jobId) {
  console.log(`🚀 Job ${jobId} started`);
  const job = await getJobStatus(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (job.status !== JOB_STATUS.PENDING) throw new Error(`Job ${jobId} is already ${job.status}`);

  try {
    await db.query('UPDATE upload_jobs SET status = $1, started_at = NOW(), progress = $2 WHERE id = $3',
      [JOB_STATUS.PROCESSING, 5, jobId]);

    const { rows, errors: parseErrors } = parseCombinedExcel(job.file_data);
    if (rows.length === 0) throw new Error('No valid rows found');

    console.log(`📝 Parsed ${rows.length} rows`);
    await db.query('UPDATE upload_jobs SET progress = $1 WHERE id = $2', [15, jobId]);

    const BATCH_SIZE = 200;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
    let itsUpserted = 0, takhmeenUpserted = 0, paymentUpserted = 0;
    const errors = [...parseErrors];
    const receivedDate = new Date().toISOString().split('T')[0];
    const client = await db.pool.connect();

    try {
      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const startIdx = batchIdx * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, rows.length);
        const batchRows = rows.slice(startIdx, endIdx);

        await client.query('BEGIN');

        try {
          // ========== ITS TABLE ==========
          const itsIds = batchRows.map(r => r.its_id);
          const existingIts = await client.query(
            `SELECT its_id FROM fmb_its_tbl WHERE its_id = ANY($1)`,
            [itsIds]
          );
          const existingItsSet = new Set(existingIts.rows.map(r => r.its_id));
          const newItsRows = batchRows.filter(r => !existingItsSet.has(r.its_id));
          const updateItsRows = batchRows.filter(r => existingItsSet.has(r.its_id));

          if (newItsRows.length > 0) {
            const values = newItsRows.map((r, i) => `($${i*4+1}, $${i*4+2}, $${i*4+3}, $${i*4+4})`).join(',');
            const params = newItsRows.flatMap(r => [r.its_id, r.sabeel_number, r.full_name, r.mohalla_name]);
            await client.query(
              `INSERT INTO fmb_its_tbl (its_id, sabil_no, name, sector) VALUES ${values}`,
              params
            );
            itsUpserted += newItsRows.length;
          }

          if (updateItsRows.length > 0) {
            const values = updateItsRows.map((r, i) =>
              `($${i*4+1}, $${i*4+2}, $${i*4+3}, $${i*4+4})`
            ).join(',');
            const params = updateItsRows.flatMap(r => [r.its_id, r.sabeel_number, r.full_name, r.mohalla_name]);
            await client.query(
              `UPDATE fmb_its_tbl AS t SET
                sabil_no = COALESCE(v.sabil_no, t.sabil_no),
                name = COALESCE(v.name, t.name),
                sector = COALESCE(v.sector, t.sector)
              FROM (VALUES ${values}) AS v(its_id, sabil_no, name, sector)
              WHERE t.its_id = v.its_id`,
              params
            );
            itsUpserted += updateItsRows.length;
          }

          // ========== TAKHMEEN TABLE ==========
          const takhmeenIds = batchRows.map(r => r.its_id);
          const existingTakhmeen = await client.query(
            `SELECT hof_its FROM fmb_takhmeen WHERE hof_its = ANY($1)`,
            [takhmeenIds]
          );
          const existingTakhmeenSet = new Set(existingTakhmeen.rows.map(r => r.hof_its));
          const newTakhmeenRows = batchRows.filter(r => !existingTakhmeenSet.has(r.its_id));
          const updateTakhmeenRows = batchRows.filter(r => existingTakhmeenSet.has(r.its_id));

          if (newTakhmeenRows.length > 0) {
            const values = newTakhmeenRows.map((r, i) => `($${i*4+1}, $${i*4+2}, $${i*4+3}::TEXT, $${i*4+4})`).join(',');
            const params = newTakhmeenRows.flatMap(r => [r.its_id, r.takhmeen_year, r.takhmeen_amount, r.previous_amount]);
            await client.query(
              `INSERT INTO fmb_takhmeen (hof_its, takhmeen_yr, takhmeen_amt, previous_amount_due) VALUES ${values}`,
              params
            );
            takhmeenUpserted += newTakhmeenRows.length;
          }

          if (updateTakhmeenRows.length > 0) {
            const values = updateTakhmeenRows.map((r, i) =>
              `($${i*4+1}::TEXT, $${i*4+2}::TEXT, $${i*4+3}::TEXT, $${i*4+4}::NUMERIC)`
            ).join(',');
            const params = updateTakhmeenRows.flatMap(r => [r.its_id, r.takhmeen_year, r.takhmeen_amount, r.previous_amount]);
            await client.query(
              `UPDATE fmb_takhmeen AS t SET
                takhmeen_yr = COALESCE(NULLIF(v.takhmeen_yr, ''), t.takhmeen_yr),
                takhmeen_amt = COALESCE(NULLIF(v.takhmeen_amt, ''), t.takhmeen_amt),
                previous_amount_due = COALESCE(v.previous_amount_due, t.previous_amount_due)
              FROM (VALUES ${values}) AS v(hof_its, takhmeen_yr, takhmeen_amt, previous_amount_due)
              WHERE t.hof_its = v.hof_its`,
              params
            );
            takhmeenUpserted += updateTakhmeenRows.length;
          }

          // ========== PAYMENT TABLE ==========
          const paymentIds = batchRows.map(r => r.its_id);
          const existingPayments = await client.query(
            `SELECT hof_its FROM fmb_payment_tbl WHERE hof_its = ANY($1)`,
            [paymentIds]
          );
          const existingPaymentsSet = new Set(existingPayments.rows.map(r => r.hof_its));
          const newPaymentRows = batchRows.filter(r => !existingPaymentsSet.has(r.its_id));
          const updatePaymentRows = batchRows.filter(r => existingPaymentsSet.has(r.its_id));

          if (newPaymentRows.length > 0) {
            const values = newPaymentRows.map((r, i) => {
              const shortHash = Math.random().toString(36).substring(2, 7).toUpperCase();
              const lastDigits = String(r.its_id).slice(-4);
              const receiptNo = `RCP-${shortHash}-${lastDigits}`;
              return `($${i*7+1}, $${i*7+2}, $${i*7+3}, $${i*7+4}, $${i*7+5}, $${i*7+6}, $${i*7+7})`;
            }).join(',');
            const params = newPaymentRows.flatMap(r => {
              const shortHash = Math.random().toString(36).substring(2, 7).toUpperCase();
              const lastDigits = String(r.its_id).slice(-4);
              const receiptNo = `RCP-${shortHash}-${lastDigits}`;
              return [receiptNo, r.its_id, r.full_name, r.paid, 'N/A', receivedDate, r.due];
            });
            await client.query(
              `INSERT INTO fmb_payment_tbl (receipt_no, hof_its, hof_name, amt_rcv, payment_mode, received_date, amt_pending) VALUES ${values}`,
              params
            );
            paymentUpserted += newPaymentRows.length;
          }

          if (updatePaymentRows.length > 0) {
            const values = updatePaymentRows.map((r, i) =>
              `($${i*4+1}::TEXT, $${i*4+2}::TEXT, $${i*4+3}::NUMERIC, $${i*4+4}::NUMERIC)`
            ).join(',');
            const params = updatePaymentRows.flatMap(r => [r.its_id, r.full_name, r.paid, r.due]);
            await client.query(
              `UPDATE fmb_payment_tbl AS t SET
                hof_name = COALESCE(NULLIF(v.hof_name, ''), t.hof_name),
                amt_rcv = COALESCE(v.amt_rcv, t.amt_rcv),
                amt_pending = COALESCE(v.amt_pending, t.amt_pending)
              FROM (VALUES ${values}) AS v(hof_its, hof_name, amt_rcv, amt_pending)
              WHERE t.hof_its = v.hof_its`,
              params
            );
            paymentUpserted += updatePaymentRows.length;
          }

          await client.query('COMMIT');
        } catch (batchErr) {
          await client.query('ROLLBACK');
          errors.push(`Batch error: ${batchErr.message}`);
          console.error(`❌ Batch ${batchIdx + 1}:`, batchErr.message);
        }

        const progress = 15 + Math.round((endIdx / rows.length) * 70);
        await db.query('UPDATE upload_jobs SET progress = $1 WHERE id = $2', [Math.min(progress, 85), jobId]);
      }

      await db.query('UPDATE upload_jobs SET progress = $1 WHERE id = $2', [90, jobId]);
      await db.query(
        `UPDATE upload_jobs SET status = $1, completed_at = NOW(), progress = 100, summary = $2 WHERE id = $3`,
        [JOB_STATUS.COMPLETED, JSON.stringify({
          recordsProcessed: rows.length,
          itsUpserted,
          takhmeenUpserted,
          paymentUpserted,
          rowErrors: errors.length - parseErrors.length,
          warnings: errors
        }), jobId]
      );
      console.log(`✅ Job ${jobId} completed!`);

    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`❌ Job ${jobId}:`, err.message);
    await db.query(
      `UPDATE upload_jobs SET status = $1, completed_at = NOW(), error_message = $2 WHERE id = $3`,
      [JOB_STATUS.FAILED, err.message, jobId]
    );
  }
}

function startWorker(interval = 1000) {
  setInterval(async () => {
    try {
      const result = await db.query(
        `SELECT id FROM upload_jobs WHERE status = $1 ORDER BY created_at ASC LIMIT 1`,
        [JOB_STATUS.PENDING]
      );
      if (result.rows.length > 0) {
        await processJob(result.rows[0].id);
      }
    } catch (err) {
      console.error('Worker error:', err);
    }
  }, interval);
}

module.exports = { JOB_STATUS, createUploadJob, getJobStatus, processJob, startWorker };
