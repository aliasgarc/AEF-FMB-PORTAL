const XLSX = require('xlsx');

/**
 * Combined FMB Upload Parser
 *
 * Expected format:
 *   Row 1: Organization banner (e.g., "DAWOODI BOHRA JAMAAT TRUST - FATEMI MOHALLA POONA") — skipped
 *   Row 2: Column header row
 *   Row 3+: Data rows
 *
 * Expected columns (case-insensitive, spaces tolerated):
 *   Sr.No#, ITS ID, Sabeel Number, FullName, MohallaName, Thaalino,
 *   TakhmeenYear, Takhmeen Type (ignored), TakhmeenAmount, Faiz WaiveOff (ignored),
 *   Previous Amount, Previous Due (ignored), Paid, Due
 *
 * Required per row: ITS ID, FullName
 * Ignored columns: Thaalino, Takhmeen Type, Faiz WaiveOff, Previous Due
 */

const HEADER_ALIASES = {
  sr_no: ['sr.no#', 'sr no', 'sn', 'sequence'],
  its_id: ['its id', 'its_id', 'itsid', 'id number'],
  sabeel_number: ['sabeel number', 'sabeel_number', 'sabeel no', 'sabil_no'],
  full_name: ['fullname', 'full name', 'name'],
  mohalla_name: ['mohallaname', 'mohalla name', 'mohalla_name', 'sector'],
  thaalino: ['thaalino', 'thaal no', 'thaal_number'], // ignored
  takhmeen_year: ['takhmeen year', 'takhmeen_year', 'takhmeenyear', 'year'],
  takhmeen_type: ['takhmeen type', 'takhmeen_type'], // ignored
  takhmeen_amount: ['takhmeenamount', 'takhmeen amount', 'takhmeen_amount', 'amount'],
  faiz_waive_off: ['faiz waiveoff', 'faiz_waive_off', 'faiz_waveoff', 'waive off'], // ignored
  previous_amount: ['previous amount', 'previous_amount', 'prev amount'],
  previous_due: ['previous due', 'previous_due', 'prior due'], // ignored
  paid: ['paid', 'paid_amount', 'amount paid'],
  due: ['due', 'amount_due', 'pending']
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
        break; // first match wins
      }
    }
  });
  return map;
}

function parseCombinedExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  if (rows.length === 0) {
    return { rows: [], errors: ['Sheet is empty'] };
  }

  if (rows.length < 3) {
    return { rows: [], errors: ['Sheet must have at least 3 rows (banner, header, data)'] };
  }

  // Row 0 is the banner, skip it
  // Row 1 is the header, build the column map
  const headerMap = buildHeaderMap(rows[1]);
  const errors = [];

  // Validate that required columns exist
  if (headerMap.its_id === undefined) {
    errors.push('Sheet must include an "ITS ID" column.');
    return { rows: [], errors };
  }
  if (headerMap.full_name === undefined) {
    errors.push('Sheet must include a "FullName" column.');
    return { rows: [], errors };
  }

  const parsed = [];

  // Row 2+ are data rows
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    // Skip fully-blank rows
    if (!row || row.every((c) => c === null || c === '')) continue;

    const get = (field) => (headerMap[field] !== undefined ? row[headerMap[field]] : null);

    const its_id = get('its_id');
    const full_name = get('full_name');

    if (!its_id || !full_name) {
      errors.push(`Row ${i + 1}: missing ITS ID or FullName — skipped.`);
      continue;
    }

    // Parse numeric fields: null if blank or non-numeric
    const parseAmount = (val) => {
      if (val === null || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const takhmeen_amt = parseAmount(get('takhmeen_amount'));
    const previous_amt = parseAmount(get('previous_amount'));
    const paid_amt = parseAmount(get('paid'));
    const due_amt = parseAmount(get('due'));

    parsed.push({
      _rowNum: i + 1, // for error reporting (1-indexed, matching Excel row numbers)
      its_id: String(its_id).trim(),
      sabeel_number: get('sabeel_number') ? String(get('sabeel_number')).trim() : null,
      full_name: String(full_name).trim(),
      mohalla_name: get('mohalla_name') ? String(get('mohalla_name')).trim() : null,
      takhmeen_year: get('takhmeen_year') ? String(get('takhmeen_year')).trim() : null,
      takhmeen_amount: takhmeen_amt,
      previous_amount: previous_amt,
      paid: paid_amt,
      due: due_amt
    });
  }

  return { rows: parsed, errors };
}

module.exports = { parseCombinedExcel };
