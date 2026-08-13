# Manual Testing Scenarios - Push Notification System

## ✅ System Status
- ✅ Server: Running on http://localhost:3000
- ✅ Service Worker: Active with push support
- ✅ Notification API: Operational
- ✅ Database: 1279 users configured
- ✅ Test notification: Already sent to all users

---

## 🧪 Test Scenario 1: Desktop Browser - In-App Notification

**Goal:** Verify notifications appear in-app when user has portal open

### Steps:
1. Open Chrome/Firefox/Edge on desktop
2. Navigate to: `http://localhost:3000/user/`
3. Enter ITS ID: `50450029`
4. Click "Check Details"

### Expected Result:
```
✅ Green notification banner appears at top:
   - Title: "🔔 Welcome to AEF-FMB Payment Tracker!"
   - Message: "Your payment tracking portal is now live..."
   - "Enable Notifications" button visible

✅ Blue permission prompt banner:
   - Title: "🔔 Enable Push Notifications"
   - "✓ Enable Notifications" button
   - "Later" button

✅ Click "Enable Notifications":
   - Browser permission dialog appears
   - User can grant or deny
```

### What You'll See:
```
┌─────────────────────────────────────────────────────────┐
│ 🔔 Enable Push Notifications                         ✕ │
│ Get notified instantly about important updates...       │
│ [✓ Enable Notifications] [Later]                       │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ 🎉 Welcome to AEF-FMB Payment Tracker!              ✕ │
│ Your payment tracking portal is now live...             │
│ Track your Takhmeen contributions...                    │
└─────────────────────────────────────────────────────────┘
```

---

## 🧪 Test Scenario 2: Desktop Browser - Permission Granted

**Goal:** Verify system confirms when notifications are enabled

### Prerequisites:
- Complete Scenario 1
- Clicked "Enable Notifications"
- Granted permission in browser dialog

### Steps:
1. Refresh the page (F5)
2. Enter ITS ID: `50450029`
3. Click "Check Details"

### Expected Result:
```
✅ Green success banner appears:
   - Title: "✅ Notifications Enabled"
   - Message: "You'll now receive notifications for important updates!"
   - Auto-disappears after 5 seconds

✅ Original notification banners still visible

✅ Permission banner NOT shown (already granted)
```

---

## 🧪 Test Scenario 3: Send Notification from Admin & See in User Portal

**Goal:** Verify admin can send notifications and users see them

### Prerequisites:
- Both browser windows open (admin & user)
- User portal logged in with ITS ID

### Steps:

**Admin Side:**
1. Open: `http://localhost:3000/admin` (login if required)
2. Click "🔔 Send Notifications" tab
3. Fill in:
   - Title: `📣 System Maintenance Alert`
   - Message: `System maintenance scheduled for tonight 2-3 AM. Please log out.`
4. Click "🔔 Send to All Users"

**User Side (watching):**
1. Watch user portal
2. A new green banner should appear at top

### Expected Result:
```
Admin Dashboard:
✅ "Notification sent to 1279 users" message appears
✅ "Recent Notifications" list updates
✅ Shows your sent notification

User Portal:
✅ New green banner appears immediately:
   - Title: "📣 System Maintenance Alert"
   - Message: "System maintenance scheduled..."
   - Banner auto-dismisses after interaction
```

---

## 🧪 Test Scenario 4: Mobile Browser - Android Chrome

**Goal:** Verify notifications work on mobile browsers

### Prerequisites:
- Android phone with Chrome
- Connected to same network as test PC (or use ngrok for remote)

### Steps:
1. On Android phone, open Chrome
2. Go to: `http://192.168.x.x:3000/user/` (replace x.x with your PC IP)
   - Find your IP: Open Command Prompt, type `ipconfig`, look for "IPv4 Address"
3. Enter ITS ID: `50450029`
4. Click "Check Details"
5. Tap "Enable Notifications"
6. Grant Android notification permission

### Expected Result:
```
Screen 1 - User Portal:
✅ Blue notification permission banner
✅ Green in-app notification banner
✅ Green success banner after enabling

Screen 2 - Notifications Work:
1. Minimize Chrome or switch to another app
2. From admin: Send notification
3. Look at Android notification panel (swipe from top)
✅ Should see notification:
   - App icon + "FMB"
   - Title and message
   - Can expand to see full message

Screen 3 - Notification Click:
✅ Tap notification → Opens app
✅ Shows user portal
✅ Notification banner visible
```

---

## 🧪 Test Scenario 5: PWA App Installation - Android

**Goal:** Verify PWA app can be installed and receives notifications

### Prerequisites:
- Android phone with Chrome
- Completed Scenario 4

### Steps:

**Install App:**
1. Go to: `http://192.168.x.x:3000/user/`
2. Open Chrome menu (3 dots)
3. Tap "Install app"
4. Tap "Install" in dialog
5. App icon appears on home screen

**Grant Permissions:**
1. Tap app icon to open
2. Enter ITS ID: `50450029`
3. Tap "Enable Notifications"
4. Grant Android permission

**Test Notifications:**
1. Close app completely (swipe it away)
2. From admin: Send new notification
3. Check Android notification panel

### Expected Result:
```
Installation:
✅ Chrome prompts "Install app?"
✅ App installs (appears on home screen)
✅ App has FMB icon

Running:
✅ App opens like normal app
✅ Looks same as browser but feels like app
✅ No address bar

Notifications:
✅ When app is CLOSED:
   - Android notification appears in tray
   - Shows app icon + notification
   - Tap → Opens installed app

✅ When app is OPEN:
   - Green banner in app
   - Also triggers Android notification
```

---

## 🧪 Test Scenario 6: PWA App - iOS

**Goal:** Verify PWA works on iOS (limited notifications)

### Prerequisites:
- iPhone with Safari
- Same network as test PC

### Steps:

**Install App:**
1. Open Safari
2. Go to: `http://192.168.x.x:3000/user/`
3. Tap Share button (rectangle with arrow)
4. Scroll, tap "Add to Home Screen"
5. Enter name (e.g., "FMB Portal")
6. Tap "Add"
7. App icon appears on home screen

**Test:**
1. Tap app icon to open
2. Enter ITS ID: `50450029`
3. Tap "Enable Notifications"
4. Grant iOS notification permission
5. Close app (go home)
6. From admin: Send notification

### Expected Result:
```
Installation:
✅ App installs to home screen
✅ Opens full-screen like app
✅ No Safari interface

Notifications (Note: Limited on iOS):
✅ In-app banner: Definitely works
✅ Push notifications: May be limited
   - Might not show when app closed
   - But will show when app opens
✅ Permission dialog: Shows

Fallback:
✅ Next time user opens app:
   - Will see notification in banner
   - Can still access all notifications
```

---

## 🧪 Test Scenario 7: Multiple Users Receiving Same Notification

**Goal:** Verify broadcast works to multiple users

### Prerequisites:
- Scenario 1 completed
- Two different ITS IDs available

### Steps:

**Setup:**
1. Open two browser windows (or tabs)
2. First window: ITS ID `50450029` → Grant permissions
3. Second window: New private/incognito window
4. Go to: `http://localhost:3000/user/`
5. ITS ID: `50450030` (or another available ID) → Grant permissions

**Test:**
1. From admin: Send notification with title "Multi-User Test"
2. Watch both windows

### Expected Result:
```
Window 1 (ITS ID 50450029):
✅ Green banner appears with notification
✅ Can interact with it

Window 2 (ITS ID 50450030):
✅ ALSO shows green banner
✅ Same notification content
✅ Both see it at roughly same time

Admin Dashboard:
✅ Shows "Sent to 1279 users"
✅ Both test users included
```

---

## 🧪 Test Scenario 8: Permission Denied - Recovery

**Goal:** Verify system handles users who deny notifications

### Prerequisites:
- Fresh browser/incognito window

### Steps:

**Deny Permission:**
1. Go to: `http://localhost:3000/user/`
2. Enter ITS ID: `50450029`
3. Click "Check Details"
4. In blue permission banner, click "Later"
5. Refresh page

**Test:**
1. Go to admin, send notification
2. Go back to user portal (another incognito tab)
3. Wait 5 seconds

### Expected Result:
```
First Load:
✅ Permission banner shows with "Later" button
✅ Can click "Later" to dismiss
✅ Banner reappears on next visit

After Denial:
✅ Orange warning banner shows:
   - "🔕 Notifications Blocked"
   - Link to enable in settings

Notification Still Works:
✅ Still see green in-app banner
✅ Can still read all notifications
✅ Just don't get OS notifications
```

---

## 🧪 Test Scenario 9: Notification Persistence

**Goal:** Verify notifications persist after refresh

### Prerequisites:
- Scenario 1 completed

### Steps:
1. User portal open: `http://localhost:3000/user/`
2. ITS ID: `50450029`
3. Note the notifications showing
4. Refresh page (F5)

### Expected Result:
```
After Refresh:
✅ Same notification banners visible
✅ No data loss
✅ Notification count accurate
✅ Can still dismiss/interact
```

---

## 🧪 Test Scenario 10: Admin Dashboard Notification History

**Goal:** Verify admin can see all sent notifications

### Steps:
1. Go to: `http://localhost:3000/admin/` (login)
2. Click "🔔 Send Notifications" tab
3. Scroll down to "Recent Notifications" section

### Expected Result:
```
✅ Shows last 10 notifications sent
✅ Each shows:
   - Title
   - First 100 chars of message
   - Date/time sent
   - Active/Inactive status

✅ List includes:
   - Welcome notification
   - Test notifications you sent
   - Maintenance alert (from Scenario 3)
```

---

## 📊 Testing Checklist

Print this out and check off each scenario:

### Desktop Tests
- [ ] Scenario 1: In-App Notification
- [ ] Scenario 2: Permission Granted
- [ ] Scenario 3: Send from Admin
- [ ] Scenario 8: Permission Denied
- [ ] Scenario 9: Persistence
- [ ] Scenario 10: Admin History

### Mobile Tests  
- [ ] Scenario 4: Mobile Browser
- [ ] Scenario 5: PWA App (Android)
- [ ] Scenario 6: PWA App (iOS)
- [ ] Scenario 7: Multiple Users

### Additional Manual Checks
- [ ] DevTools: Service Worker active
- [ ] DevTools: No console errors
- [ ] Notifications work with slow network
- [ ] Notifications work offline (cached)

---

## 🐛 Troubleshooting During Testing

### Notification Not Showing
```
Check:
1. Is permission granted? (Address bar lock icon)
2. Is Service Worker active? (F12 → Application → Service Workers)
3. Check console (F12) for errors
4. Clear cache: Ctrl+Shift+Delete
5. Reload service worker: F12 → Application → Update on reload (check it)
```

### Permission Prompt Not Appearing
```
Try:
1. Open in incognito/private window
2. Check if domain is blocked (Settings → Notifications)
3. Run in DevTools: Notification.permission
4. Manually check browser notification settings
```

### App Not Opening on Notification Click
```
Debug:
1. Check if app is really installed (home screen)
2. Try clicking "Open Portal" action button instead
3. Check Service Worker notification click handler:
   - F12 → Application → Service Worker → Source
   - Look for notificationclick listener
```

### Notifications Show But No Sound
```
Check:
1. Android: Settings → Notifications → FMB → Sound
2. iOS: Settings → Notifications → App Name → Sound
3. Browser: Notification sounds controlled by browser settings
4. Desktop: Windows/Mac notification settings
```

---

## 🎯 Success Criteria

System is working correctly when:

✅ **Desktop Browser**
- Notifications appear as green banners
- Permission prompt shows and works
- Notifications persist after refresh

✅ **Android PWA App**
- App installs successfully
- Notifications appear in Android tray when app closed
- Tapping notification opens app

✅ **iOS PWA App**
- App installs to home screen
- Notifications appear in-app
- User can access all notifications

✅ **Admin Dashboard**
- Can send notifications to all users
- Sees success confirmation
- Recent notifications list updates

✅ **Multiple Users**
- Different ITS IDs receive same notification
- Broadcast works correctly
- No duplicate notifications

---

## 📱 Quick Reference: URLs

| Page | URL | Purpose |
|------|-----|---------|
| User Portal | http://localhost:3000/user/ | Test notifications display |
| Admin Panel | http://localhost:3000/admin/ | Send notifications |
| API: Get Notifications | http://localhost:3000/api/notifications/50450029 | Check API |
| API: Send Notification | POST to http://localhost:3000/api/notifications/admin/send | Automated sending |
| Health Check | http://localhost:3000/health | Verify server |

---

## 📝 Test Report Template

```
Date: ____________
Tester: __________
Device: __________

Scenario 1 - In-App Notification: [ ] Pass [ ] Fail
Issues: _________________________________

Scenario 2 - Permission Granted: [ ] Pass [ ] Fail
Issues: _________________________________

Scenario 3 - Send from Admin: [ ] Pass [ ] Fail
Issues: _________________________________

[Continue for all scenarios...]

Overall Result: [ ] All Pass [ ] Some Issues [ ] Critical Issues

Issues Found:
1. _________________________________
2. _________________________________
3. _________________________________

Recommendations:
_________________________________________
_________________________________________
```

---

## 🚀 Next Steps After Testing

1. ✅ Test all scenarios above
2. ✅ Document any issues
3. 📊 Collect performance metrics
4. 🔧 Fix critical issues
5. 🎉 Deploy to production
6. 📱 Test with real users
7. 📈 Monitor notification delivery

---

**Ready to test? Start with Scenario 1!**
