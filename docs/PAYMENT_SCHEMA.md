# FMB Payment Table Schema Documentation

## Overview

The system now supports two types of uploads:

1. **User/Customer Data** (`fmb_its_tbl`) - User demographics and contact info
2. **Payment Receipts** (`fmb_payment_tbl`) - Actual payment transactions received

---

## Payment Table Structure (`fmb_payment_tbl`)

### Columns

| Column | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| `payment_id` | INTEGER | Auto | Primary key, auto-generated | 1001 |
| `receipt_no` | VARCHAR | **YES** | Unique receipt/transaction number | RCP-2026-001 |
| `hof_its` | INTEGER | **YES** | HOF ITS ID (links to fmb_its_tbl) | 1001 |
| `hof_name` | VARCHAR | **YES** | HOF/Payer name | Ravi Kumar |
| `amt_rcv` | NUMERIC | **YES** | Amount received | 5000.00 |
| `payment_mode` | VARCHAR | **YES** | Payment method | Cash, Bank Transfer, UPI, Check, NEFT |
| `received_date` | VARCHAR | **YES** | Date payment was received | 2026-01-15 |
| `amt_pending` | NUMERIC | **YES** | Amount still pending/due | 0.00 |
| `payment_refrence` | VARCHAR | Optional | Reference number/notes | REF-1001, Bank Ref #, etc. |
| `mobile_no` | VARCHAR | Optional | Contact phone number | 9876543210 |
| `created_at` | TIMESTAMP | Auto | Record creation timestamp | Auto-set |

---

## Excel Upload Format for Payments

### Required Columns (MUST include):
- `receipt_no` - Unique receipt identifier
- `hof_its` - HOF ITS ID number
- `hof_name` - Payer/HOF name
- `amt_rcv` - Amount received
- `payment_mode` - How payment was made
- `received_date` - When payment was received (YYYY-MM-DD format)
- `amt_pending` - Outstanding amount after this payment

### Optional Columns:
- `payment_refrence` - Bank/check reference, remarks
- `mobile_no` - Phone number

### Column Aliases (flexible naming):

| Primary Name | Accepted Aliases |
|--------------|------------------|
| `receipt_no` | receipt #, receipt number, receipt_number, trans_id, transaction_id |
| `hof_its` | hof_its_id, hof its, its_id, its number |
| `hof_name` | hof_name, name, payer_name, payer name |
| `amt_rcv` | amt_rcv, amount_received, amount rcv, amount_rcvd, received_amount |
| `payment_mode` | payment_mode, mode, payment_method, method |
| `received_date` | received_date, received date, payment_date, date_received |
| `amt_pending` | amt_pending, amount_pending, pending_amount, outstanding |
| `payment_refrence` | payment_refrence, reference, ref, remarks, notes |
| `mobile_no` | mobile_no, mobile, phone, phone_number |

---

## Payment Modes (Recommended Values)

Standard payment modes to use:
- **Cash** - Cash payment
- **Bank Transfer** - Direct bank transfer/NEFT/RTGS
- **Check** - Cheque payment
- **UPI** - UPI payment
- **NEFT** - National Electronic Funds Transfer
- **RTGS** - Real Time Gross Settlement
- **Demand Draft** - DD payment
- **Online** - General online payment
- **Other** - Any other mode

---

## Data Validation Rules

### Receipt Number (`receipt_no`)
- Must be **unique** per upload
- Can contain letters, numbers, hyphens: `RCP-2026-001`
- Max 50 characters

### HOF ITS ID (`hof_its`)
- Must be **numeric** integer
- Should correspond to existing user in `fmb_its_tbl`
- Example: `1001`, `1002`, etc.

### Amounts (`amt_rcv`, `amt_pending`)
- Must be **numeric** (decimals allowed)
- Format: `5000`, `5000.50`, `5000.00`
- Cannot be negative

### Dates (`received_date`)
- Format: **YYYY-MM-DD** (required)
- Example: `2026-01-15`, `2026-12-31`
- System will auto-convert from Excel date format

### Payment Mode (`payment_mode`)
- Must be a valid mode string
- Case-insensitive (converts to title case)
- Max 50 characters

---

## Sample Data

See `sample-upload-template.csv` for complete example:

| receipt_no | hof_its | hof_name | amt_rcv | payment_mode | received_date | amt_pending | payment_refrence | mobile_no |
|---|---|---|---|---|---|---|---|---|
| RCP-2026-001 | 1001 | Ravi Kumar | 5000 | Cash | 2026-01-15 | 0 | REF-1001 | 9876543210 |
| RCP-2026-002 | 1002 | Sana Sheikh | 3000 | Bank Transfer | 2026-01-16 | 4500 | REF-1002 | 9876500011 |
| RCP-2026-003 | 1003 | Amit Verma | 2000 | Check | 2026-01-17 | 2200 | REF-1003 | 9876511122 |
| RCP-2026-004 | 1004 | Priya Sharma | 7500 | UPI | 2026-01-18 | 1500 | REF-1004 | 9876522233 |
| RCP-2026-005 | 1005 | Rajesh Singh | 4200 | NEFT | 2026-01-19 | 0 | REF-1005 | 9876533344 |

---

## Upload Workflow

### Step 1: Prepare Excel File
- Use CSV or XLSX format
- Include header row with column names (case-insensitive)
- Column order doesn't matter
- One payment per row

### Step 2: Upload via Admin Dashboard
- Go to Admin Portal → Payment Receipts
- Select file
- Click "Upload Payments"

### Step 3: Review Results
- System shows: "X payment records added successfully"
- Any errors are shown with row numbers
- Partial uploads are possible (good rows are inserted, bad rows skipped)

### Step 4: Verify in Admin Dashboard
- View payment history
- Check pending amounts
- Track payment status

---

## Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Missing receipt_no" | Receipt number not provided | Ensure all rows have receipt_no |
| "Invalid hof_its" | HOF ITS ID is not numeric | Use numbers only (1001, 1002, etc.) |
| "Invalid amount" | Amount format error | Use numeric format: 5000 or 5000.50 |
| "Invalid date format" | Date not in YYYY-MM-DD | Use format: 2026-01-15 |
| "Duplicate receipt_no" | Receipt already exists in same batch | Ensure unique receipt numbers |
| "HOF not found" | hof_its doesn't exist in system | First upload user data to fmb_its_tbl |

---

## Related Tables

### fmb_its_tbl (Users/Customers)
- Stores customer/HOF information
- `hof_its` in payment table references this

### fmb_payment_tbl (This Table)
- Stores individual payment transactions
- One row per payment receipt
- Append-only history (no updates to past records)

---

## Important Notes

⚠️ **Reconciliation:**
- `amt_rcv` = amount received in this transaction
- `amt_pending` = remaining amount due (including this payment)
- Track: `previous_pending - amt_rcv = amt_pending`

⚠️ **Historical Accuracy:**
- Once uploaded, payment records should not be edited
- If correction needed, contact administrator
- System maintains audit trail via `created_at`

⚠️ **Data Integrity:**
- HOF ITS ID must exist in `fmb_its_tbl`
- Receipt numbers must be unique
- Dates must be valid (no future-dated receipts)

---

## Bulk Upload Tips

✅ **Best Practices:**
- Batch process by date range or location
- Use consistent receipt numbering scheme
- Always verify HOF ITS IDs exist before upload
- Keep payment reference info consistent
- Upload in chronological order if possible

✅ **Performance:**
- System can handle 1000+ receipts per upload
- Larger batches take longer to process
- Split very large files (10k+ rows) into smaller batches

---

## API Integration (Advanced)

### POST /api/admin/upload-payments
```json
{
  "file": "multipart/form-data",
  "format": "xlsx or csv"
}
```

**Response:**
```json
{
  "ok": true,
  "paymentsInserted": 15,
  "warnings": [],
  "summary": {
    "totalReceived": 67500,
    "recordsProcessed": 15
  }
}
```

---

## FAQ

**Q: Can I edit a payment record after upload?**
A: Not through the upload interface. Contact admin for corrections.

**Q: What if HOF doesn't exist yet?**
A: Upload user data to fmb_its_tbl first, then upload payments.

**Q: Can I use different date formats?**
A: Excel dates auto-convert, but CSV should use YYYY-MM-DD.

**Q: Is payment history permanent?**
A: Yes, records are append-only. Updates require manual DB intervention.

**Q: Can amounts be negative (refunds)?**
A: Currently no - system expects positive amounts only.

