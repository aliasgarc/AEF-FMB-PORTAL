# Utilities Organization

## Structure

```
src/utils/
├── parsers/              # Data parsing utilities
│   ├── index.js         # Export barrel for clean imports
│   ├── combinedUploadParser.js    # FMB combined 3-table upload
│   ├── excelParser.js             # Legacy user data upload
│   └── paymentParser.js           # Legacy payment receipt upload
└── README.md            # This file
```

## Usage

### Import Pattern (Clean - Recommended)
```javascript
const { parseCombinedExcel, parsePaymentExcel, parsePaymentReceipts } = require('./parsers');

// Use directly
const result = parseCombinedExcel(buffer);
```

### Direct Import Pattern (Specific)
```javascript
const { parseCombinedExcel } = require('./parsers/combinedUploadParser');
```

## Parser Functions

### `parseCombinedExcel(buffer)`
- **File**: `src/utils/parsers/combinedUploadParser.js`
- **Purpose**: Parse FMB jamaat export with 2-row preamble (banner + headers)
- **Input**: Excel file buffer
- **Output**: `{ rows: [...], errors: [...] }`
- **Format**:
  - Row 1: Organization banner (auto-skipped)
  - Row 2: Column headers
  - Row 3+: Data records
- **Requirements**: ITS ID, FullName (required per row)

### `parsePaymentExcel(buffer)`
- **File**: `src/utils/parsers/excelParser.js`
- **Purpose**: Legacy - parse user/payment records (DEPRECATED)
- **Status**: Kept for backward compatibility, not actively used

### `parsePaymentReceipts(buffer)`
- **File**: `src/utils/parsers/paymentParser.js`
- **Purpose**: Legacy - parse payment receipts (DEPRECATED)
- **Status**: Kept for backward compatibility, not actively used

## Current Active Usage

**Only `parseCombinedExcel` is actively used:**
- Route: `POST /api/admin/upload-combined` (src/routes/admin.js)
- Handler: 3-table upsert (fmb_its_tbl, fmb_takhmeen, fmb_payment_tbl)

## Adding New Parsers

1. Create new file in `src/utils/parsers/`
2. Export function: `module.exports = { parseXxx }`
3. Add to `src/utils/parsers/index.js`:
   ```javascript
   parseXxx: require('./xxxParser').parseXxx,
   ```
4. Import from `src/utils/parsers` in calling code

## Maintainability Notes

- **Barrel Export**: `index.js` centralizes all parser imports for cleaner code
- **Separation of Concerns**: Each parser is independent and can be maintained separately
- **No Circular Dependencies**: Parsers don't import from routes or other services
- **Test-Friendly**: Parsers can be tested in isolation without mocking HTTP
