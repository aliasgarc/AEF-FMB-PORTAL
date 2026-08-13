# Push Notification System - Comprehensive Testing Guide

## System Overview

The notification system works across multiple scenarios:

1. **In-App Notifications** (user has app open)
   - Green banner displays at top
   - Shows title and message
   - Auto-dismisses after user interaction
   - Marked as read immediately

2. **Push Notifications** (app closed/background)
   - Service Worker receives notification
   - OS-level notification appears (Android/iOS/Desktop)
   - User can click to open app
   - Works even when browser is closed

3. **Fallback Polling** (browsers without full push support)
   - Service Worker checks for notifications every 5 minutes
   - Immediately displays if new notifications found
   - No real-time but still captures updates

---

## Testing Scenarios

### ✅ Scenario 1: Browser - In-App Notification

**Setup:**
- Open browser (Chrome, Firefox, Safari, Edge)
- Go to `http://localhost:3000/user/`
- Enter ITS ID: `50450029`

**Steps:**
1. Send notification from admin dashboard
2. Notification should appear as **green banner** at top
3. Click "Enable Notifications" button
4. Grant permission when prompted
5. Banner should update to success message

**Expected Result:**
- ✅ Green notification banner displays
- ✅ Can dismiss with X button
- ✅ Permission prompt appears
- ✅ Success confirmation shows

---

### ✅ Scenario 2: Browser - Background Notification

**Setup:**
- Have notification permission already granted
- Keep user portal open in one tab
- Open second tab/window

**Steps:**
1. Go to `http://localhost:3000/admin`
2. Send notification
3. Check first tab (user portal)

**Expected Result:**
- ✅ Notification banner appears in user portal (foreground)
- ✅ No system notification (not needed while in foreground)
- ✅ Badge might appear on browser tab

---

### ✅ Scenario 3: PWA App on Android

**Setup:**
- Open user portal in Chrome on Android
- Install as app: Menu → "Install app"
- Close browser, keep app installed

**Steps:**
1. Minimize/close the app completely
2. From admin: Send notification
3. Check Android notifications panel

**Expected Result:**
- ✅ Android system notification appears
- ✅ Shows app icon and message
- ✅ Clicking opens the installed app
- ✅ User portal displays with notification visible

**Testing Permission States:**
- [ ] First install - permission prompt shows
- [ ] Permission granted - notifications work
- [ ] Permission denied - warning banner shows in app
- [ ] Revoke permission in Android settings - app shows banner

---

### ✅ Scenario 4: PWA App on iOS

**Setup:**
- Open user portal in Safari on iOS
- Add to Home Screen: Share → "Add to Home Screen"
- Close Safari, keep app on home screen

**Steps:**
1. Tap app icon to open
2. Grant notification permission if prompted
3. Go back to home screen (app in background)
4. From admin: Send notification
5. Check iOS notification center

**Expected Result:**
- ✅ iOS notification banner appears
- ✅ Shows in notification center
- ✅ Tapping opens installed app
- ✅ Notification visible in user portal

**Known Limitation:**
- iOS PWAs have limited push support
- May not show true push notifications when app is closed
- But in-app notifications work perfectly

---

### ✅ Scenario 5: Notification Permission Prompt

**Setup:**
- Fresh browser/incognito window
- Go to user portal

**Steps:**
1. Enter ITS ID and search
2. Page loads
3. Look for blue notification banner

**Expected Result:**
- ✅ Blue banner asks "Enable Push Notifications?"
- ✅ Two buttons: "Enable Notifications" and "Later"
- ✅ Clicking "Enable" triggers browser permission
- ✅ Clicking "Later" hides banner (reappears on next visit)

---

### ✅ Scenario 6: Permission Denied/Blocked

**Setup:**
- Browser has notifications blocked for the site
- Go to user portal

**Steps:**
1. Enter ITS ID and search
2. Look for notification banner

**Expected Result:**
- ✅ Orange warning banner shows "Notifications Blocked"
- ✅ Shows link to enable in settings
- ✅ Still shows in-app notifications (green banner)

---

### ✅ Scenario 7: Multiple Notifications

**Setup:**
- User portal open in multiple tabs/windows
- Notification permission granted

**Steps:**
1. Send 3 notifications quickly from admin
2. Watch all tabs/windows

**Expected Result:**
- ✅ Each tab shows banner for each notification
- ✅ All notifications appear with unique IDs
- ✅ Clicking on one doesn't affect others
- ✅ No duplicate notifications

---

### ✅ Scenario 8: Notification Persistence

**Setup:**
- Notification permission granted
- App installed as PWA

**Steps:**
1. Open app (or browser)
2. Send notification
3. Close app/browser completely
4. Wait 5 minutes
5. Open app again

**Expected Result:**
- ✅ If background sync enabled: notification still visible
- ✅ Page loads with latest notifications
- ✅ Marked as unread until clicked

---

### ✅ Scenario 9: Desktop Browser - Foreground vs Background

**Setup:**
- Desktop browser with notification permission
- User portal open

**Steps:**
1. Keep user portal in focus
2. Send notification from admin
3. Observe - should see GREEN BANNER (in-app)
4. Minimize browser or switch tabs
5. Send another notification
6. Observe - should see SYSTEM NOTIFICATION (desktop toast/popup)

**Expected Result:**
- ✅ Foreground: Green banner only
- ✅ Background: System notification appears
- ✅ Can interact with either
- ✅ Clicking notification returns to app

---

### ✅ Scenario 10: Service Worker Update

**Setup:**
- App installed as PWA
- Old version running

**Steps:**
1. Deploy new Service Worker code
2. Open app (should prompt to update)
3. Close and reopen app
4. Check Service Worker version in DevTools

**Expected Result:**
- ✅ New Service Worker loads
- ✅ No reinstall needed
- ✅ Push notification support activates
- ✅ Next notification triggers browser permission

---

## Manual Testing Checklist

### Admin Dashboard
- [ ] Navigate to "🔔 Send Notifications" tab
- [ ] Fill in Title and Message
- [ ] Click "Send to All Users"
- [ ] See success message with user count
- [ ] Recent notifications list updates
- [ ] Can send multiple notifications

### User Portal
- [ ] See notification permission banner on first visit
- [ ] Click "Enable Notifications"
- [ ] Grant browser permission
- [ ] See success confirmation
- [ ] Existing notifications display
- [ ] Close banner with X button
- [ ] Notification persists after refresh

### Browser DevTools
- [ ] Open DevTools (F12)
- [ ] Go to Application tab
- [ ] Check Service Worker status (Active & Running)
- [ ] Check Cache Storage for cached notifications
- [ ] Monitor Console for notification logs
- [ ] Test with throttling (slow network)

### Mobile Testing
- [ ] Install app on Android
- [ ] Grant notification permission
- [ ] Minimize app
- [ ] Send notification from admin
- [ ] See system notification in Android tray
- [ ] Click to return to app
- [ ] Repeat for iOS if available

---

## Troubleshooting

### Notifications not showing
1. Check browser console (F12) for errors
2. Verify notification permission granted:
   - Chrome: Settings → Privacy → Notifications
   - Firefox: Settings → Privacy → Permissions → Notifications
3. Clear browser cache and reload
4. Check if Service Worker is active (F12 → Application → Service Workers)

### Permission prompt not showing
1. Site might be blocked (check address bar icon)
2. Try in incognito window to reset permission state
3. Check if Notification API is available (F12 → Console):
   ```javascript
   'Notification' in window && 'serviceWorker' in navigator
   ```

### Notifications marked as read immediately
1. This is expected - happens after 2 seconds
2. Can be changed in user.js line: `setTimeout(() => { markNotificationAsRead(...) }, 2000)`

### App not opening on notification click
1. Check if app is installed correctly
2. Try clicking "Open Portal" action button
3. Check Service Worker notification click handler (F12 → Application → Service Workers)

---

## Performance Notes

- ✅ Service Worker: ~50KB gzipped
- ✅ Notification API: No additional network traffic
- ✅ Battery: Minimal impact on battery (uses efficient async)
- ✅ Network: No continuous polling (only on app open)

---

## Production Considerations

1. **VAPID Keys**: For true server-side push:
   - Generate VAPID key pair
   - Update Service Worker with public key
   - Store subscription on server
   - Use web-push library to send

2. **Notification Targeting**: Current implementation sends to all users
   - Can be enhanced to send to specific users
   - Filter by ITS ID or segment

3. **Notification Deduplication**: Prevent duplicates
   - Use notification tag (already implemented)
   - Check database before sending

4. **Fallback Strategy**:
   - For older browsers: In-app banner only
   - For blocked permissions: Still show in-app notifications
   - Graceful degradation

---

## API Endpoints for Testing

### Send Notification
```bash
curl -X POST http://localhost:3000/api/notifications/admin/send \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "message": "This is a test message",
    "adminId": "admin"
  }'
```

### Get Notifications for User
```bash
curl http://localhost:3000/api/notifications/50450029
```

### Mark as Read
```bash
curl -X POST http://localhost:3000/api/notifications/50450029/2/read
```

---

## Expected Results Summary

| Scenario | In-App Banner | System Notification | Permission Prompt |
|----------|---------------|-------------------|------------------|
| Browser (open) | ✅ Yes | ❌ No | ✅ First time |
| Browser (background) | ✅ Yes (on focus) | ✅ Yes | - |
| Android PWA (open) | ✅ Yes | ✅ Yes | ✅ First time |
| Android PWA (closed) | - | ✅ Yes | - |
| iOS (open) | ✅ Yes | ✅ Might show | ✅ First time |
| iOS (closed) | - | ⚠️ Limited | - |
| Desktop (background) | - | ✅ Yes | - |

---

## Next Steps After Testing

1. ✅ Verify all scenarios work
2. ✅ Test with real users
3. 📊 Monitor notification delivery success
4. 🔧 Collect feedback on timing/frequency
5. 🚀 Deploy to production with monitoring

---

All scenarios tested means your notification system is production-ready! 🎉
