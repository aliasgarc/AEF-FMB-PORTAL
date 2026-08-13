# Previous Amount Due Implementation

## Summary
Added the `previous_amount_due` column from the `fmb_takhmeen` table to both the admin and user portal pages, displaying it in dedicated tables with proper formatting and responsiveness.

## Changes Made

### 1. **Backend API Updates**

#### Admin Users List (`src/routes/admin.js`)
- Added `previous_amount_due` to the users list query
- Casts and coalesces the column value to handle NULL or missing values
- Updated GROUP BY clause to include the new column

```sql
COALESCE(CAST(t.previous_amount_due AS NUMERIC(12,2)), 0)::numeric(12,2) AS previous_amount_due
```

#### Admin Detail View (`src/routes/admin.js`)
- Updated payment_records query to include `previous_amount_due`
- Handles NULL values gracefully with COALESCE

#### User API (`src/routes/user.js`)
- Updated fmb_takhmeen query to include `previous_amount_due`
- Casts and coalesces to ensure numeric output

### 2. **Admin Dashboard Updates**

#### HTML Changes (`public/admin/dashboard.html`)
- Added new column header: `📊 Prev Due` in users table
- Updated column headers for all columns after insertion
- Added CSS for column widths (10% for new column)
- Updated mobile CSS labels to include "PREV" for the new column

#### JavaScript Changes (`public/admin/admin.js`)
- Updated `renderUsers()` function to display `previous_amount_due`
- Styled with amber color (#f59e0b) to highlight previous amounts due
- Updated detail panel HTML to show previous_amount_due in payment history
- Modified `showDetail()` function to include previous_amount_due from payment_records

### 3. **User Portal Updates**

#### HTML Changes (`public/user/index.html`)
- **New Takhmeen Contributions Table:**
  - Added dedicated table section for takhmeen contributions
  - Columns: Year, Amount Billed, Previous Due, Comments
  - Positioned before Payment Receipts table
  - Added empty state message for no takhmeen records
  
- **CSS Styling:**
  - Desktop table layout with fixed column widths
  - Column 1 (Year): 15%
  - Column 2 (Billed): 28%
  - Column 3 (Previous Due): 28%
  - Column 4 (Comments): 29%
  
- **Mobile CSS:**
  - Responsive block layout for small screens
  - Labels displayed as ::before pseudo-elements
  - "PREV DUE" label for mobile display
  - Consistent padding and text alignment

#### JavaScript Changes (`public/user/user.js`)
- Added takhmeen table population code
- Fetches takhmeen data from API response
- Displays year, amount billed, and previous_amount_due
- Styled with amber color for previous due amounts
- Shows empty state if no takhmeen records exist

## Features

✅ **Admin Dashboard:**
- Displays previous_amount_due in user list
- Shows in user detail panel
- Mobile responsive with abbreviated labels
- Color-coded (amber) for visibility

✅ **User Portal:**
- Dedicated takhmeen contributions table
- Displays yearly contributions and previous amounts due
- Mobile responsive with card-style layout
- Clear visual hierarchy with color coding
- Comments field for additional information

✅ **Responsive Design:**
- Desktop: Fixed-width columns with horizontal scroll
- Mobile: Card-style layout with labels as pseudo-elements
- Touch-friendly spacing and tap targets
- Proper text wrapping and overflow handling

## Data Flow

```
API Request
    ↓
fmb_takhmeen table (previous_amount_due column)
    ↓
API Response includes previous_amount_due
    ↓
JavaScript populates table
    ↓
User sees Previous Due amount displayed
```

## Testing Checklist

- [x] Admin users list shows Previous Due column
- [x] Admin detail panel shows Previous Due in history
- [x] User portal displays Takhmeen Contributions table
- [x] Previous amount due values display correctly
- [x] Mobile layout is responsive
- [x] Empty states display when no data
- [x] API returns previous_amount_due field
- [x] Color coding is consistent (amber for due amounts)

## Files Modified

1. `src/routes/admin.js` - API endpoints for admin users
2. `src/routes/user.js` - API endpoint for user data
3. `public/admin/dashboard.html` - Admin UI with new column
4. `public/admin/admin.js` - Admin JS logic
5. `public/user/index.html` - User portal UI with takhmeen table
6. `public/user/user.js` - User portal JS logic

## Migration Required

Run the following SQL to ensure the columns exist:

```sql
ALTER TABLE IF EXISTS payment_records
ADD COLUMN IF NOT EXISTS previous_amount_due NUMERIC(12,2) DEFAULT 0;

ALTER TABLE IF EXISTS fmb_takhmeen
ADD COLUMN IF NOT EXISTS previous_amount_due NUMERIC(12,2) DEFAULT 0;
```

A migration script is available at: `execute-previous-amount-due.js`

## API Response Example

### User API Response
```json
{
  "takhmeen": [
    {
      "id": 14,
      "takhmeen_yr": "1447-48",
      "takhmeen_amt": "126792.00",
      "previous_amount_due": "0.00",
      "comment": null,
      "created_at": "2026-08-14T03:53:26.904Z",
      "updated_at": "2026-08-15T09:59:16.373Z"
    }
  ]
}
```

### Admin API Response
```json
{
  "users": [
    {
      "its_id": "50450029",
      "name": "User Name",
      "total_billed": "126792.00",
      "previous_amount_due": "0.00",
      "amount_received": "126792.00",
      "amount_pending": "0.00",
      "outstanding": "0.00"
    }
  ]
}
```

## Styling Details

### Color Scheme
- **Green (#22c55e)**: Amount Billed, Amount Received
- **Amber (#f59e0b)**: Previous Due, Pending Amounts
- **Red (#ef4444)**: Outstanding (when > 0)

### Responsive Breakpoints
- **Desktop**: Full table layout with horizontal columns
- **Tablet (768px)**: Adjusted padding and font sizes
- **Mobile (640px)**: Block layout with card-style rows

## Notes

- All amount values use the currency formatting function for consistency
- NULL values are handled gracefully with COALESCE(..., 0)
- Mobile labels are abbreviated to fit small screens (e.g., "PREV" instead of "PREVIOUS DUE")
- Previous due amounts are styled distinctly to draw attention
- Empty states prevent confusion when no data exists
