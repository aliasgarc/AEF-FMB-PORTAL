const XLSX = require('xlsx');

/**
 * Expected columns in the uploaded sheet (header row, case-insensitive,
 * spaces/underscores both fine):
 *
 *   its_id        (recommended) - user's ITS ID
 *   sabil_no      (optional) - alternative identifier
 *   hof_its       (optional)
 *   name          (required)
 *   address       (optional)
 *   mobile        (optional)
 *   email         (optional)
 *   city          (optional)
 *   pincode       (optional)
 *   sector        (optional)
 *   sub_sector    (optional)
 *   period_label      e.g. "Jan 2026" / invoice number
 *   amount_billed     numeric
 *   amount_paid       numeric
 *   due_date          date
 *   status            paid | partial | pending
 *   notes
 *
 * Each row upserts the user (by its_id) and, if it has any
 * billing info, inserts a new payment_records row for history.
 */

const HEADER_ALIASES = {
  its_id: ['its_id', 'its id', 'itsid', 'account number', 'id number', 'unique_number'],
  sabil_no: ['sabil_no', 'sabil no', 'sabil number'],
  hof_its: ['hof_its', 'hof its'],
  name: ['name', 'full name', 'user name'],
  address: ['address'],
  mobile: ['mobile', 'phone', 'phone number'],
  email: ['email', 'email address'],
  city: ['city'],
  pincode: ['pincode', 'postal code', 'zip code'],
  sector: ['sector'],
  sub_sector: ['sub_sector', 'sub sector', 'subsector'],
  period_label: ['period_label', 'period', 'invoice', 'invoice number', 'month'],
  amount_billed: ['amount_billed', 'amount billed', 'billed', 'bill amount'],
  amount_paid: ['amount_paid', 'amount paid', 'paid'],
  due_date: ['due_date', 'due date'],
  status: ['status'],
  notes: ['notes', 'note', 'remarks']
};

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase();
}

function buildHeaderMap(headerRow) {
  const map = {}; // normalized field -> column index
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

  if (headerMap.name === undefined) {
    errors.push('Sheet must include a "name" column. "its_id" is recommended as a unique identifier.');
    return { rows: [], errors };
  }

  const parsed = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === null || c === '')) continue; // skip blank rows

    const get = (field) => (headerMap[field] !== undefined ? row[headerMap[field]] : null);

    const name = get('name');

    if (!name) {
      errors.push(`Row ${i + 1}: missing name — skipped.`);
      continue;
    }

    let dueDate = get('due_date');
    if (dueDate instanceof Date) {
      dueDate = dueDate.toISOString().slice(0, 10);
    } else if (typeof dueDate === 'number') {
      // Excel stores dates as serial day numbers when the cell isn't
      // tagged with a date format (common when a sheet is built from CSV).
      const parts = XLSX.SSF.parse_date_code(dueDate);
      dueDate = parts ? `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}` : null;
    } else if (dueDate) {
      const asDate = new Date(dueDate);
      dueDate = isNaN(asDate.getTime()) ? String(dueDate) : asDate.toISOString().slice(0, 10);
    } else {
      dueDate = null;
    }

    parsed.push({
      its_id: get('its_id') ? String(get('its_id')).trim() : null,
      sabil_no: get('sabil_no') ? String(get('sabil_no')).trim() : null,
      hof_its: get('hof_its') ? String(get('hof_its')).trim() : null,
      name: String(name).trim(),
      address: get('address') ? String(get('address')).trim() : null,
      mobile: get('mobile') ? String(get('mobile')).trim() : null,
      email: get('email') ? String(get('email')).trim() : null,
      city: get('city') ? String(get('city')).trim() : null,
      pincode: get('pincode') ? String(get('pincode')).trim() : null,
      sector: get('sector') ? String(get('sector')).trim() : null,
      sub_sector: get('sub_sector') ? String(get('sub_sector')).trim() : null,
      period_label: get('period_label') ? String(get('period_label')).trim() : null,
      amount_billed: Number(get('amount_billed')) || 0,
      amount_paid: Number(get('amount_paid')) || 0,
      due_date: dueDate,
      status: get('status') ? String(get('status')).trim().toLowerCase() : null,
      notes: get('notes') ? String(get('notes')).trim() : null
    });
  }

  return { rows: parsed, errors };
}

module.exports = { parsePaymentExcel };
