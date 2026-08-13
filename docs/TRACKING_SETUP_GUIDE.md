# User Tracking Setup Guide

## Complete Implementation Steps

### 1. Database Setup (PostgreSQL)

Run these SQL commands to set up tracking:

```sql
-- Create user fetch history table
CREATE TABLE IF NOT EXISTS user_fetch_history (
  id SERIAL PRIMARY KEY,
  its_id VARCHAR(50) NOT NULL,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_fetch ON user_fetch_history(its_id, fetched_at DESC);

-- Add timestamp columns if they don't exist
ALTER TABLE fmb_payment_tbl
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE fmb_takhmeen
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create triggers to auto-update timestamps
CREATE OR REPLACE FUNCTION update_payment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_update_trigger ON fmb_payment_tbl;
CREATE TRIGGER payment_update_trigger
BEFORE UPDATE ON fmb_payment_tbl
FOR EACH ROW
EXECUTE FUNCTION update_payment_timestamp();

-- Same for takhmeen
CREATE OR REPLACE FUNCTION update_takhmeen_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS takhmeen_update_trigger ON fmb_takhmeen;
CREATE TRIGGER takhmeen_update_trigger
BEFORE UPDATE ON fmb_takhmeen
FOR EACH ROW
EXECUTE FUNCTION update_takhmeen_timestamp();
```

### 2. Backend Changes

**File: src/routes/user.js**
- ✅ Already updated to:
  - Query `created_at` and `updated_at` from tables
  - Track user fetch in `user_fetch_history` table
  - Return `tracking` object with:
    - `lastFetch`: When user last checked their account
    - `lastPaymentUpdate`: Last time payment records changed
    - `lastTakhmeeUpdate`: Last time takhmeen records changed
    - `totalFetches`: How many times user has checked

### 3. Frontend Changes

**File: public/user/user.js**
- ✅ Added `formatDateTime()` function for date formatting
- ✅ Updated `renderResult()` to handle tracking data
- ✅ Display last update date in meta information

**File: public/user/index.html**
- Add tracking info display section (see below)

### 4. HTML Update Required

Add this section to `public/user/index.html` after the existing meta display:

```html
<!-- Tracking Information -->
<div id="trackingInfo" style="margin-top: 12px; font-size: 12px; color: #666;">
  <span id="trackingMeta"></span>
</div>
```

Then in `user.js`, add to the `renderResult()` function:

```javascript
// Display tracking information
const trackingMeta = document.getElementById('trackingMeta');
if (trackingMeta && tracking) {
  const trackingParts = [];
  if (tracking.totalFetches) {
    trackingParts.push(`✓ Checked ${tracking.totalFetches} times`);
  }
  if (tracking.lastPaymentUpdate) {
    trackingParts.push(`📊 Payments last updated: ${formatDateTime(tracking.lastPaymentUpdate)}`);
  }
  if (tracking.lastTakhmeeUpdate) {
    trackingParts.push(`💚 Takhmeen last updated: ${formatDateTime(tracking.lastTakhmeeUpdate)}`);
  }
  trackingMeta.innerHTML = trackingParts.join('<br>');
}
```

### 5. API Response Format

```json
{
  "user": { /* user info */ },
  "takhmeen": [ /* takhmeen records */ ],
  "payments": [ /* payment records */ ],
  "summary": { /* totals */ },
  "tracking": {
    "lastFetch": "2026-08-14T10:30:00Z",
    "lastPaymentUpdate": "2026-08-13T15:45:00Z",
    "lastTakhmeeUpdate": "2026-08-12T09:20:00Z",
    "totalFetches": 5
  }
}
```

## Testing Checklist

- [ ] Run SQL setup commands
- [ ] Verify `user_fetch_history` table exists
- [ ] Verify timestamp columns exist on `fmb_payment_tbl` and `fmb_takhmeen`
- [ ] Make an API call: `GET /api/user/50450029`
- [ ] Verify response includes `tracking` object
- [ ] Update HTML with tracking info section
- [ ] Test on user page - should show last update dates
- [ ] Check that timestamps update when data changes
- [ ] Verify fetch count increments on each lookup

## Benefits

✅ Users see when their data was last updated  
✅ Track record fetch history for auditing  
✅ Detect stale data  
✅ Transparency for users on data freshness  
✅ Identify which records were recently modified
