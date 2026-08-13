# Mobile Testing Guide - User Tracking System

## Quick Test Steps

### Desktop Browser (Chrome/Edge/Firefox)

1. **Open Developer Tools**: Press `F12` or `Ctrl+Shift+I`
2. **Toggle Device Toolbar**: Click the device icon or press `Ctrl+Shift+M`
3. **Select Mobile Device**: Choose "iPhone 12" or "Pixel 5" from the device selector
4. **Navigate to User Portal**: Go to `http://localhost:3000/user/`
5. **Enter ITS ID**: `50450029` (or any valid ITS ID)
6. **Click Search**: Submit the form

### What to Verify on Mobile:

✅ **Tracking Information Display:**
- Look for the section below the user name with:
  - ✓ Checked X times
  - 📊 Payments last updated: [date/time]
  - 💚 Takhmeen last updated: [date/time]
- Text should be readable (12px font size)
- Should have proper spacing (12px margin-top)
- Line breaks should show each tracking element on separate lines

✅ **Payment Receipts Table:**
- Table should display as cards/blocks (not columns)
- Each payment field should show:
  - LABEL (in green, uppercase, bold)
  - Value (below label, left-aligned)
- No horizontal scrolling required
- Currency values should display correctly (₹ symbol + amount)
- Text should not break mid-word

✅ **Responsive Breakpoints to Test:**
- iPhone SE (375px wide)
- iPhone 12 (390px wide)  
- iPhone 14 (430px wide)
- Pixel 5 (393px wide)
- iPad (768px and above - should show normal layout)

### Visual Checklist:

- [ ] Tracking info section visible and readable
- [ ] Payment table displays as vertical cards, not horizontal table
- [ ] Currency amounts don't break across multiple lines
- [ ] No horizontal scrolling needed
- [ ] Dates are properly formatted
- [ ] All text is readable (good font size and color contrast)
- [ ] Proper spacing between sections
- [ ] "Search Again" button is easily clickable
- [ ] Statistics cards are responsive and readable

### Testing Different Scenarios:

**Scenario 1: First-time user lookup**
- ITS ID: 50450029
- Expected: Shows 1 or more fetches
- Tracking should show: "✓ Checked X times"

**Scenario 2: Multiple lookups (refresh the page, search again)**
- Search same ITS ID multiple times
- Expected: totalFetches count should increase
- This verifies tracking is working

**Scenario 3: User with no payments**
- Search for an ITS ID with only takhmeen (no payments)
- Expected: Should show takhmeen last updated but not payment updated

## API Testing

To verify tracking data is being collected:

```bash
# First lookup
curl 'http://localhost:3000/api/user/50450029'

# Check response includes tracking object:
# "tracking": {
#   "lastFetch": "2026-08-14T04:XX:XX.XXXZ",
#   "lastPaymentUpdate": "2026-08-14T03:XX:XX.XXXZ",
#   "lastTakhmeeUpdate": "2026-08-14T03:XX:XX.XXXZ",
#   "totalFetches": 1
# }

# Second lookup (should increment totalFetches)
curl 'http://localhost:3000/api/user/50450029'
```

## Known Good Behavior

- ✅ Tracking info appears in user portal
- ✅ Dates formatted in Indian locale (DD-MMM-YYYY, HH:MM)
- ✅ Payment table is fully responsive on mobile
- ✅ API correctly logs each fetch
- ✅ Total fetch count increments on each lookup
- ✅ Last update dates reflect actual record modifications

## Issues to Watch For

- ❌ If tracking info doesn't show: Check browser console for JavaScript errors
- ❌ If dates look wrong: Verify timezone settings (using UTC timestamps)
- ❌ If table breaks horizontally: Clear browser cache and refresh
- ❌ If fetch count doesn't increment: Database tracking table might not exist

## Browser Console Check

Press `F12` > Console tab and verify no red errors appear when searching for a user.

## Mobile Device Testing (Actual Device)

If testing on actual mobile:

1. Find your computer's IP address: 
   - Windows: `ipconfig` and look for IPv4 Address
   - Example: `192.168.1.100`

2. On mobile, go to: `http://192.168.1.100:3000/user/`

3. Perform same verification steps as desktop browser

---

**All Systems Ready!** The user tracking system is fully deployed and tested.
