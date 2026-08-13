# Outstanding Calculation Fix

## Issue Found
The outstanding amount calculation was incorrect. It was showing:
- **Wrong:** Outstanding = Takhmeen - Received
- **Correct:** Outstanding = Previous Due + Takhmeen - Received

## Example (from screenshots)
For user with:
- Previous Amount Due: ₹20,800
- Current Takhmeen: ₹126,000
- Amount Received: ₹20,800

**Old Calculation (Wrong):**
```
Outstanding = ₹126,000 - ₹20,800 = ₹105,200 ❌
```

**New Calculation (Correct):**
```
Outstanding = ₹20,800 + ₹126,000 - ₹20,800 = ₹126,000 ✅
```

## Fixes Applied

### 1. **Admin Users List API** (`src/routes/admin.js`)
Updated the SQL query to calculate:
```sql
outstanding = previous_amount_due + takhmeen_amt - amount_received
```

### 2. **Admin Detail View API** (`src/routes/admin.js`)
Updated to include previous_amount_due in calculations:
```javascript
outstanding: totalPreviousDue + totalBilled - totalPaid
```

### 3. **User API** (`src/routes/user.js`)
Updated to correctly sum previous amounts due:
```javascript
outstanding: totalPreviousDue + totalBilled - totalReceived
```

## Database Requirement

The `previous_amount_due` column must exist in these tables:
1. **fmb_takhmeen** - stores previous_amount_due for each year
2. **payment_records** - stores previous_amount_due for each billing period

### Add Columns (if missing)
```sql
ALTER TABLE fmb_takhmeen ADD COLUMN IF NOT EXISTS previous_amount_due NUMERIC(12,2) DEFAULT 0;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS previous_amount_due NUMERIC(12,2) DEFAULT 0;
```

### Run Migration
```bash
node execute-previous-amount-due.js
```

## Populate Previous Amount Due

If you have existing data, populate `previous_amount_due` using one of these methods:

### Method 1: Excel Upload
When uploading Excel files, include a `previous_amount_due` column and it will be imported.

### Method 2: Manual SQL Update
```sql
-- Update fmb_takhmeen with specific values per year/user
UPDATE fmb_takhmeen 
SET previous_amount_due = 20800.00 
WHERE hof_its = 50450029 AND takhmeen_yr = '1447-48';

-- Update payment_records with specific values
UPDATE payment_records 
SET previous_amount_due = 20800.00 
WHERE user_id = 1 AND period_label = 'Jan 2026';
```

### Method 3: Bulk Upload
Create a CSV with columns: `hof_its`, `takhmeen_yr`, `previous_amount_due`
Then import using the admin dashboard's Data Upload feature.

## Testing

After populating the data, verify the calculations:

### Test User API
```bash
curl http://localhost:3000/api/user/50450029
```

Expected response:
```json
{
  "takhmeen": [
    {
      "takhmeen_yr": "1447-48",
      "takhmeen_amt": "126000.00",
      "previous_amount_due": "20800.00"
    }
  ],
  "summary": {
    "totalBilled": 126000,
    "totalPreviousDue": 20800,
    "totalReceived": 20800,
    "outstanding": 126000
  }
}
```

### Test Admin API
Admin users list will now show correct Outstanding values:
```
Outstanding = Previous Due (₹20,800) + Takhmeen (₹126,000) - Received (₹20,800)
Outstanding = ₹126,000 ✅
```

## UI Impact

### Admin Dashboard
- Users List: Outstanding column now correctly includes previous_amount_due
- Detail Panel: Outstanding in summary reflects previous_amount_due

### User Portal
- Takhmeen Contributions Table: Shows previous_amount_due
- Statistics: "Amount Pending" now correctly shows total outstanding

## Files Modified

1. `src/routes/admin.js` - Fixed SQL and calculation logic
2. `src/routes/user.js` - Fixed summary calculation
3. `db/add-previous-amount-due.sql` - Migration to add columns
4. `execute-previous-amount-due.js` - Script to run migration

## Next Steps

1. Run the migration to ensure columns exist
2. Populate `previous_amount_due` values in your database
3. Restart the server
4. Verify outstanding amounts are now correct

## Verification Checklist

- [ ] Migration script executed successfully
- [ ] previous_amount_due column exists in fmb_takhmeen
- [ ] previous_amount_due column exists in payment_records
- [ ] Data populated with correct previous_amount_due values
- [ ] Server restarted
- [ ] User portal shows correct Outstanding
- [ ] Admin dashboard shows correct Outstanding
- [ ] Calculation matches: Previous Due + Takhmeen - Received
