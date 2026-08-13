# App Update Notifications System

## Overview

The app update notification system ensures that:
- ✅ Existing users are notified when new versions are available
- ✅ Both admin and user apps can send separate update notifications
- ✅ Users see what features/fixes are new
- ✅ Critical updates can be marked as required
- ✅ All users receive update notifications (no reinstall needed)

---

## How It Works

### Current Version Tracking

```javascript
// src/routes/app-updates.js
const CURRENT_VERSION = '1.2.0'; // Update this on each deployment

// When new features added:
// 1.0.0 - Initial release
// 1.1.0 - Notification banners + UI improvements
// 1.2.0 - Push notifications + User tracking
// 1.3.0 - Coming next...
```

### Version Check Flow

```
User opens app
     ↓
System checks: userVersion (stored locally) vs CURRENT_VERSION (server)
     ↓
If different:
  • Check if update is required (major version bump)
  • Get update message + new features
  • Display orange or red banner
     ↓
User can:
  • Click "Refresh to Update" (reloads page)
  • Click "Later" (dismisses for 15 seconds)
  • Close with X button
     ↓
Service Worker auto-updates on page reload ✅
```

---

## For Admins - Sending Update Notifications

### Via Admin Dashboard (Future Enhancement):

1. Go to Admin Dashboard
2. New Tab: "🔄 App Updates" (to be added)
3. Select update type: User App / Admin App / Both
4. Enter version number (e.g., 1.2.0)
5. Type update title + message
6. List new features
7. Send to all users

### Via API (Right Now):

```bash
curl -X POST http://localhost:3000/api/app/notify-update \
  -H "Content-Type: application/json" \
  -d '{
    "title": "✨ New Features Available",
    "message": "Push notifications are now available! Enable them to get instant updates.",
    "version": "1.2.0",
    "appType": "user",
    "adminId": "admin"
  }'
```

**Response:**
```json
{
  "success": true,
  "updateId": 1,
  "notificationId": 5,
  "message": "Update notification sent to 1279 users",
  "version": "1.2.0",
  "appType": "user"
}
```

---

## Update Banner Display

### Regular Update (Orange Banner):
```
┌─────────────────────────────────────────────────┐
│ 📦 App Update Available                      ✕ │
│ You're running v1.1.0 → Update to v1.2.0       │
│                                                  │
│ What's New:                                    │
│ • Push notifications                           │
│ • User tracking system                         │
│ • Mobile optimizations                         │
│                                                  │
│ [🔄 Refresh to Update] [Later]                │
└─────────────────────────────────────────────────┘
```

### Critical Update (Red Banner):
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Critical Update Required                   ✕ │
│ Important security update: v1.0.0 → v1.2.0     │
│ Please refresh to get the latest version       │
│                                                  │
│ [🔄 Refresh to Update] [Later]                │
└─────────────────────────────────────────────────┘
```

---

## API Endpoints

### 1. Get Current Version
```
GET /api/app/version

Response:
{
  "version": "1.2.0",
  "timestamp": "2026-08-14T...",
  "features": [
    "User tracking system",
    "Push notifications",
    "Admin notifications dashboard",
    "Mobile responsive design",
    "Offline support"
  ]
}
```

### 2. Check if Update Available
```
POST /api/app/check-update

Request:
{
  "userVersion": "1.1.0",
  "itsId": "50450029",
  "appType": "user"
}

Response:
{
  "currentVersion": "1.2.0",
  "userVersion": "1.1.0",
  "hasUpdate": true,
  "updateRequired": false,
  "updateMessage": "Updates available! New features: push notifications...",
  "updateFeatures": [
    "v1.2.0: Push notifications, User tracking"
  ],
  "downloadUrl": "/user/"
}
```

### 3. Send Update Notification to All Users
```
POST /api/app/notify-update

Request:
{
  "title": "✨ Push Notifications Now Available",
  "message": "We've added instant notifications...",
  "version": "1.2.0",
  "appType": "user",  // or "admin" or "both"
  "adminId": "admin"
}

Response:
{
  "success": true,
  "updateId": 1,
  "notificationId": 5,
  "message": "Update notification sent to 1279 users",
  "version": "1.2.0"
}
```

### 4. Get All Update History (Admin)
```
GET /api/app/updates

Response:
{
  "updates": [
    {
      "id": 1,
      "version": "1.2.0",
      "title": "Push Notifications",
      "message": "...",
      "app_type": "user",
      "created_by": "admin",
      "created_at": "2026-08-14T...",
      "is_active": true
    },
    ...
  ],
  "totalUpdates": 5
}
```

---

## Update Scenarios

### Scenario 1: Regular Feature Update
```
Version: 1.1.0 → 1.2.0
Type: Feature update (notifications)
Banner: Orange (informational)
Action: User can refresh when convenient
Status: Not required
```

### Scenario 2: Security Update
```
Version: 1.1.0 → 1.2.0 (with security fix)
Type: Security patch
Banner: Red (requires action)
Action: User should refresh immediately
Status: Required (isUpdateRequired: true)
```

### Scenario 3: Minor Bug Fix
```
Version: 1.2.0 → 1.2.1
Type: Patch version
Banner: Not shown (optional update)
Action: Auto-update on next app open
Status: Not critical
```

### Scenario 4: Breaking Change
```
Version: 1.x.x → 2.0.0
Type: Major version
Banner: Red (critical)
Action: Force update recommended
Status: Required
```

---

## Deployment Workflow

### When Deploying New Code:

1. **Update Version Number** (src/routes/app-updates.js):
   ```javascript
   const CURRENT_VERSION = '1.3.0'; // Bumped from 1.2.0
   ```

2. **Deploy Code** (Service Worker + other changes)

3. **Send Update Notification** (within 5 minutes):
   ```bash
   curl -X POST http://localhost:3000/api/app/notify-update \
     -H "Content-Type: application/json" \
     -d '{
       "title": "New Features Available!",
       "message": "We've added...",
       "version": "1.3.0",
       "appType": "user",
       "adminId": "admin"
     }'
   ```

4. **Results**:
   - ✅ All 1279 users notified
   - ✅ Orange banner appears when they next open app
   - ✅ Shows new features
   - ✅ Link to "Refresh to Update"
   - ✅ Service Worker auto-updates on refresh

---

## Database Schema

### app_updates Table
```sql
CREATE TABLE app_updates (
  id SERIAL PRIMARY KEY,
  version VARCHAR(20),              -- e.g., "1.2.0"
  title VARCHAR(255),               -- Update title
  message TEXT,                     -- Full message
  app_type VARCHAR(50),             -- 'user', 'admin', or 'both'
  created_by VARCHAR(100),          -- Admin who sent it
  created_at TIMESTAMP,             -- When sent
  is_active BOOLEAN                 -- If notification is active
);
```

### Indexes
- `idx_app_updates_version` - Query by version
- `idx_app_updates_active` - Query active updates

---

## Version Naming Convention

Follow **Semantic Versioning** (semver):

```
MAJOR.MINOR.PATCH

Examples:
- 1.0.0 - Initial release
- 1.0.1 - Bug fix
- 1.1.0 - New feature added
- 1.2.0 - Multiple features
- 2.0.0 - Breaking changes
```

**When to bump:**
- **MAJOR** (1→2): Breaking changes, major redesign
- **MINOR** (1.2→1.3): New features (backwards compatible)
- **PATCH** (1.2.0→1.2.1): Bug fixes only

---

## Update Features List

Automatically extracts new features for each version:

```javascript
// Hard-coded in app-updates.js
const features = {
  '1.2.0': ['Push notifications', 'User tracking', 'Mobile optimizations'],
  '1.1.0': ['Notification banners', 'UI improvements'],
  '1.0.0': ['Initial release']
};

// Shows features for all versions newer than user's current version
// User on 1.0.0 will see both 1.1.0 AND 1.2.0 features
```

---

## Testing Updates

### Test Update Check:
```bash
curl -X POST http://localhost:3000/api/app/check-update \
  -H "Content-Type: application/json" \
  -d '{
    "userVersion": "1.1.0",
    "itsId": "50450029",
    "appType": "user"
  }'
```

### Test Update Notification:
1. Go to user portal
2. Open DevTools (F12)
3. Set mock version: `localStorage.setItem('appVersion', '1.0.0')`
4. Refresh page
5. Should see orange update banner ✅

### Test Critical Update:
1. Call `/api/app/notify-update` with security patch
2. Set `version: "2.0.0"` (major bump)
3. User will see red "Critical" banner
4. "Refresh to Update" button remains

---

## For Users

### What They See:

**First Time After Update:**
1. Orange banner: "App Update Available"
2. Shows what's new
3. Can click "Refresh" or "Later"
4. Banner auto-hides after 15 seconds (if not critical)

**Clicking Refresh:**
1. Page reloads
2. Service Worker updates automatically
3. New features become available ✅
4. No reinstall needed!

**Admin Update:**
1. Same process but for admin dashboard
2. Separate notifications if marked as "admin" app
3. Shows admin-specific features

---

## No User Reinstall Required! ✅

The beauty of the PWA architecture:
- ✅ Service Worker auto-updates on page reload
- ✅ No "reinstall from app store" needed
- ✅ Users can update anytime (they control when)
- ✅ Critical updates can be marked as required
- ✅ Works on web and installed app

---

## Monitoring Updates

### View All Sent Updates:
```bash
curl http://localhost:3000/api/app/updates
```

### Dashboard Display (Future):
- List of all updates sent
- Date/time sent
- Number of users notified
- Active/inactive status
- Which app type (user/admin/both)

---

## Common Scenarios

### New Features Available (1.2.0 → 1.3.0):
```
Action: Send update notification
Result: Orange banner appears
User: Can update when convenient
```

### Security Patch Needed:
```
Action: Send update notification + mark critical
Result: Red banner appears
User: Should update ASAP
```

### Bug Fix (1.2.0 → 1.2.1):
```
Action: Deploy without notification (minor patch)
Result: Service Worker updates automatically
User: Doesn't see banner (transparent update)
```

### Scheduled Maintenance:
```
Action: Send notification ahead of time
Result: Blue notification banner (separate from updates)
User: Prepared for planned downtime
```

---

## Best Practices

✅ **DO:**
- Update version number before deploying
- Send notification about features users will see
- Keep feature list clear and concise
- Mark security updates as critical
- Notify both admin and user if both changed

❌ **DON'T:**
- Deploy code without updating version
- Send notifications for internal refactoring
- Send too many notifications (max 1-2 per week)
- Force updates for minor patches
- Forget to update the features list

---

## Future Enhancements

🔮 Possible improvements:
- [ ] Admin dashboard UI for sending updates
- [ ] Schedule updates for specific time
- [ ] Update rollback capability
- [ ] A/B testing for notification messages
- [ ] Analytics on update acceptance rate
- [ ] Forced update for security patches
- [ ] Custom update messages per user segment
- [ ] Offline update notifications (cached)

---

## Quick Reference

| Task | Command |
|------|---------|
| Check current version | `GET /api/app/version` |
| Check if user needs update | `POST /api/app/check-update` |
| Send update to all users | `POST /api/app/notify-update` |
| View all updates sent | `GET /api/app/updates` |
| Update version number | Edit `src/routes/app-updates.js` |
| View user's current version | User stores in localStorage |

---

**The update system ensures all users stay informed and get new features automatically!** ✨
