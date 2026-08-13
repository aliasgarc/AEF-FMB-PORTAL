const XLSX = require('xlsx');

/**
 * Payment Receipt Parser - parses fmb_payment_tbl uploads
 *
 * Expected columns (case-insensitive):
 *   receipt_no       (required) - unique receipt identifier
 *   hof_its          (required) - HOF ITS ID (numeric)
 *   hof_name         (required) - HOF/Payer name
 *   amt_rcv          (required) - amount received
 *   payment_mode     (required) - payment method
 *   received_date    (required) - date payment received
 *   amt_pending      (required) - amount still pending
 *   payment_refrence (optional) - reference/remarks
 *   mobile_no        (optional) - contact number
 */

const HEADER_ALIASES = {
  receipt_no: ['receipt_no', 'receipt #', 'receipt number', 'receipt_number', 'trans_id', 'transaction_id'],
  hof_its: ['hof_its', 'hof_its_id', 'hof its', 'its_id', 'its number', 'its_number'],
  hof_name: ['hof_name', 'name', 'payer_name', 'payer name', 'hof'],
  amt_rcv: ['amt_rcv', 'amount_received', 'amount rcv', 'amount_rcvd', 'received_amount', 'amount'],
  payment_mode: ['payment_mode', 'mode', 'payment_method', 'method', 'payment method'],
  received_date: ['received_date', 'received date', 'payment_date', 'date_received', 'date received', 'payment date'],
  amt_pending: ['amt_pending', 'amount_pending', 'pending_amount', 'outstanding', 'pending', 'outstanding_amount'],
  payment_refrence: ['payment_refrence', 'reference', 'ref', 'remarks', 'notes', 'payment_reference'],
  mobile_no: ['mobile_no', 'mobile', 'phone', 'phone_number', 'phone number', 'mobile_number']
};

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase();
}

function buildHeaderMap(headerRow) {
  const map = {};
  headerRow.forEach((rawHeader, idx) => {
    const norm = normalizeHeader(rawHeader);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(norm)) {
        map[field] = idx;
      }
    }
  });
  return map;
}

function parsePaymentExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  if (rows.length === 0) {
    return { rows: [], errors: ['Sheet is empty'] };
  }

  const headerMap = buildHeaderMap(rows[0]);
  const errors = [];

  // Check for required columns
  const required = ['receipt_no', 'hof_its', 'hof_name', 'amt_rcv', 'payment_mode', 'received_date', 'amt_pending'];
  const missing = required.filter(field => headerMap[field] === undefined);
  if (missing.length > 0) {
    errors.push(`Sheet must include these columns: ${missing.join(', ')}`);
    return { rows: [], errors };
  }

  const parsed = [];
  const seenReceipts = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === null || c === '')) continue; // skip blank rows

    const get = (field) => (headerMap[field] !== undefined ? row[headerMap[field]] : null);

    const receiptNo = get('receipt_no');
    const hofIts = get('hof_its');
    const hofName = get('hof_name');
    const amtRcv = get('amt_rcv');
    const paymentMode = get('payment_mode');
    const receivedDate = get('received_date');
    const amtPending = get('amt_pending');

    // Validation
    if (!receiptNo || !hofIts || !hofName || amtRcv === null || amtRcv === '' || !paymentMode || !receivedDate || amtPending === null || amtPending === '') {
      errors.push(`Row ${i + 1}: missing required fields (receipt_no, hof_its, hof_name, amt_rcv, payment_mode, received_date, amt_pending) — skipped.`);
      continue;
    }

    // Check for duplicate receipt numbers within batch
    if (seenReceipts.has(String(receiptNo).trim())) {
      errors.push(`Row ${i + 1}: duplicate receipt_no "${receiptNo}" in this batch — skipped.`);
      continue;
    }
    seenReceipts.add(String(receiptNo).trim());

    // Parse HOF ITS (must be numeric)
    const hofItsNum = Number(hofIts);
    if (!Number.isInteger(hofItsNum) || hofItsNum <= 0) {
      errors.push(`Row ${i + 1}: hof_its must be a positive integer — skipped.`);
      continue;
    }

    // Parse amounts
    const amtRcvNum = Number(amtRcv);
    const amtPendingNum = Number(amtPending);
    if (isNaN(amtRcvNum) || amtRcvNum < 0 || isNaN(amtPendingNum) || amtPendingNum < 0) {
      errors.push(`Row ${i + 1}: amounts must be non-negative numbers — skipped.`);
      continue;
    }

    // Parse received date
    let dateStr = String(receivedDate).trim();
    if (receivedDate instanceof Date) {
      dateStr = receivedDate.toISOString().slice(0, 10);
    } else if (typeof receivedDate === 'number') {
      const parts = XLSX.SSF.parse_date_code(receivedDate);
      dateStr = parts ? `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}` : String(receivedDate);
    } else if (receivedDate) {
      // Try to parse as date string
      const asDate = new Date(dateStr);
      if (!isNaN(asDate.getTime())) {
        dateStr = asDate.toISOString().slice(0, 10);
      }
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      errors.push(`Row ${i + 1}: received_date must be in YYYY-MM-DD format — skipped.`);
      continue;
    }

    parsed.push({
      receipt_no: String(receiptNo).trim(),
      hof_its: hofItsNum,
      hof_name: String(hofName).trim(),
      amt_rcv: amtRcvNum,
      payment_mode: String(paymentMode).trim(),
      received_date: dateStr,
      amt_pending: amtPendingNum,
      payment_refrence: get('payment_refrence') ? String(get('payment_refrence')).trim() : null,
      mobile_no: get('mobile_no') ? String(get('mobile_no')).trim() : null
    });
  }

  return { rows: parsed, errors };
}

module.exports = { parsePaymentExcel };
