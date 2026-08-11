# PWA Architecture & Data Flow Diagrams

## 1. Overall PWA Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER DEVICE                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     BROWSER                               │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  HTML (dashboard.html / index.html)               │  │   │
│  │  │  - Meta tags & manifest links                     │  │   │
│  │  │  - Install banner UI                              │  │   │
│  │  │  - Offline indicators                             │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                           ↓                               │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  SERVICE WORKER (service-worker.js)               │  │   │
│  │  │  ┌──────────────────────────────────────────────┐ │  │   │
│  │  │  │ Install Event → Pre-cache static assets      │ │  │   │
│  │  │  │ Activate Event → Clean old caches           │ │  │   │
│  │  │  │ Fetch Event → Intercept requests             │ │  │   │
│  │  │  │   ├─ Static Assets → Cache-first             │ │  │   │
│  │  │  │   ├─ API Calls → Network-first (5s timeout) │ │  │   │
│  │  │  │   └─ Auth Endpoints → Network-only           │ │  │   │
│  │  │  └──────────────────────────────────────────────┘ │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                           ↓                               │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  CLIENT-SIDE STORAGE                              │  │   │
│  │  │  ┌──────────────────────────────────────────────┐ │  │   │
│  │  │  │ Cache API (Service Worker caches)            │ │  │   │
│  │  │  │ - payment-tracker-static-v1 (~100 KB)       │ │  │   │
│  │  │  │ - payment-tracker-dynamic-v1 (~50 KB)       │ │  │   │
│  │  │  │ - payment-tracker-api-v1 (~20 KB)           │ │  │   │
│  │  │  └──────────────────────────────────────────────┘ │  │   │
│  │  │  ┌──────────────────────────────────────────────┐ │  │   │
│  │  │  │ IndexedDB (offline-storage.js)               │ │  │   │
│  │  │  │ - users (list with lookup_time index)       │ │  │   │
│  │  │  │ - userDetails (detail with lookup_time)     │ │  │   │
│  │  │  │ - stats (dashboard stats with timestamp)    │ │  │   │
│  │  │  │ - syncQueue (pending uploads)                │ │  │   │
│  │  │  └──────────────────────────────────────────────┘ │  │   │
│  │  │  ┌──────────────────────────────────────────────┐ │  │   │
│  │  │  │ Cookies (HTTP-only, set by server)           │ │  │   │
│  │  │  │ - JWT auth token (for admin endpoints)       │ │  │   │
│  │  │  └──────────────────────────────────────────────┘ │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                           ↓                               │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  JAVASCRIPT LOGIC                                  │  │   │
│  │  │  ├─ admin.js (dashboard logic)                    │  │   │
│  │  │  ├─ user.js (lookup logic)                        │  │   │
│  │  │  ├─ pwa-install.js (install handler)              │  │   │
│  │  │  └─ offline-storage.js (IndexedDB interface)      │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  MANIFEST & THEME                                  │  │   │
│  │  │  ├─ manifest.json (app metadata & icons)           │  │   │
│  │  │  └─ 8 icon files (192×192, 512×512 + maskable)     │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           ↕                                      │
│              INTERNET (When Connected)                           │
│                           ↕                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    SERVER (Vercel)                       │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ Express App (src/app.js)                           │  │   │
│  │  │ ├─ Static Assets (/public/*)                       │  │   │
│  │  │ ├─ Admin Routes (/api/admin/*)  [Protected]        │  │   │
│  │  │ └─ User Routes (/api/user/*)    [Public]           │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ Database (Neon Postgres)                           │  │   │
│  │  │ ├─ fmb_its_tbl (users)                             │  │   │
│  │  │ ├─ fmb_takhmeen (contributions)                    │  │   │
│  │  │ ├─ fmb_payment_tbl (receipts)                      │  │   │
│  │  │ ├─ payment_records (legacy billing)                │  │   │
│  │  │ └─ admins (authentication)                         │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Worker Request Handling Flow

```
REQUEST FROM PAGE
       │
       ▼
SERVICE WORKER FETCH EVENT
       │
       ├─── Is it /api/admin/login or /api/admin/logout?
       │    YES → NETWORK-ONLY (no cache)
       │         └─ Send request, return response
       │
       ├─── Is it a static asset (.css, .js, .png, .woff)?
       │    YES → CACHE-FIRST
       │         ├─ Check cache → Found? → Return cached version
       │         └─ Not in cache?
       │            ├─ Fetch from network
       │            ├─ Store in cache
       │            └─ Return fresh response
       │
       ├─── Is it an API endpoint (/api/*)?
       │    YES → NETWORK-FIRST (with 5s timeout)
       │         ├─ Try to fetch with timeout
       │         ├─ Success? → Store in cache + return
       │         └─ Timeout/Error?
       │            ├─ Check cache
       │            ├─ Found? → Return cached (stale data)
       │            └─ Not found?
       │               ├─ Offline JSON: { error: "offline", offline: true }
       │               └─ Response 503
       │
       └─── Is it a GET request to page?
            YES → CACHE-FIRST
                 ├─ Check cache → Found? → Return cached
                 └─ Not found?
                    ├─ Fetch from network
                    ├─ Store in cache
                    └─ Return fresh response
```

---

## 3. Offline Data Flow

### Admin Dashboard - User List Fetch

```
USER CLICKS "Users" TAB
       │
       ▼
admin.js: fetchUsers()
       │
       ├─ ONLINE?
       │  │
       │  YES → Fetch /api/admin/users
       │       │
       │       ├─ Success (200)?
       │       │  ├─ Save to IndexedDB (offlineStorage.saveUsers())
       │       │  └─ Render table
       │       │
       │       └─ Error/Timeout?
       │          ├─ Try IndexedDB fallback
       │          ├─ Data exists?
       │          │  ├─ YES → Render cached data + show "offline" indicator
       │          │  └─ NO → Show error message
       │          └─ If error, catch handles it
       │
       └─ OFFLINE?
          └─ Catch block
             ├─ Load from IndexedDB
             ├─ Data exists?
             │  ├─ YES → Render + show "Showing cached data" badge
             │  └─ NO → Show "No cached data" message
             └─ Show offline notification
```

### User Portal - Account Lookup

```
USER ENTERS ITS ID & CLICKS "CHECK"
       │
       ▼
user.js: lookupForm.submit
       │
       ├─ ONLINE?
       │  │
       │  YES → Fetch /api/user/ITS_ID
       │       │
       │       ├─ Success?
       │       │  ├─ Save to IndexedDB (offlineStorage.saveUserDetail())
       │       │  └─ Render result
       │       │
       │       └─ Error (404, 500)?
       │          ├─ Try IndexedDB for this ITS_ID
       │          ├─ Data exists?
       │          │  ├─ YES → Render cached data + "offline" badge
       │          │  └─ NO → Show error
       │          └─ Catch handles timeout
       │
       └─ OFFLINE?
          └─ Directly check IndexedDB
             ├─ Data exists?
             │  ├─ YES → Render + show "This is cached data" badge
             │  └─ NO → Show "No cached data for this ID" message
             └─ Show offline notification
```

---

## 4. Installation Flow

```
USER VISITS APP FIRST TIME
       │
       ▼
beforeinstallprompt EVENT FIRED
       │
       ├─ Browser has installer
       │ │
       │ YES → deferredPrompt = event
       │       │
       │       ▼
       │   pwa-install.js: showInstallPrompt()
       │   │
       │   ├─ Display install banner
       │   ├─ User sees: "📱 Get Quick Access"
       │   └─ Buttons: [Install] [Not Now]
       │
       └─ NO → Install prompt hidden
              (Browser doesn't support or conditions not met)
              
USER CLICKS [INSTALL]
       │
       ▼
PWAInstaller.triggerInstall()
       │
       ├─ Show native OS install dialog
       │  (e.g., "Install Payment Admin?" on Android)
       │
       └─ User chooses:
          │
          ├─ [Install] → OS installs app
          │  │
          │  ▼
          │  appinstalled EVENT
          │  │
          │  ├─ Hide banner
          │  ├─ Add CSS class "pwa-installed"
          │  └─ App icon appears on home screen
          │
          └─ [Cancel] → Prompt closes, try again later
```

---

## 5. Cache Management Lifecycle

```
SERVICE WORKER LIFECYCLE
│
├─ INSTALL EVENT (First visit)
│  │
│  ├─ Create cache: payment-tracker-static-v1
│  │  └─ Pre-cache: [All static assets listed in STATIC_ASSETS]
│  │     ├─ HTML files (login, dashboard, index)
│  │     ├─ CSS (shared.css)
│  │     ├─ JS (admin.js, user.js, pwa-install.js, etc.)
│  │     ├─ Images (logo.png, icons)
│  │     └─ Fonts (Google Fonts if included)
│  │
│  └─ skipWaiting() → Activate immediately
│
├─ FETCH EVENT (Every request)
│  │
│  ├─ Static request? → Store in payment-tracker-static-v1
│  ├─ API request? → Store in payment-tracker-api-v1
│  └─ Dynamic HTML? → Store in payment-tracker-dynamic-v1
│
├─ ACTIVATE EVENT (When new SW available)
│  │
│  └─ Delete old caches:
│     ├─ Keep: payment-tracker-static-v1 (current version)
│     ├─ Keep: payment-tracker-api-v1 (current version)
│     └─ Delete: payment-tracker-static-v0 (old versions)
│
└─ PERIODIC CLEANUP (30 days)
   │
   └─ offlineStorage.clearOldData()
      ├─ Query IndexedDB: lookup_time < (now - 30 days)
      └─ Delete old entries
         ├─ Old user data
         ├─ Old user details
         └─ Old stats
```

---

## 6. IndexedDB Schema

```
DATABASE: PaymentTrackerDB (version: 1)
│
├─ OBJECT STORE: users
│  ├─ keyPath: its_id (unique)
│  ├─ Index: lookup_time
│  └─ Stores:
│     ├─ its_id (key)
│     ├─ name
│     ├─ mobile
│     ├─ email
│     ├─ sector
│     ├─ total_billed
│     ├─ amount_received
│     ├─ amount_pending
│     ├─ outstanding
│     └─ lookup_time (indexed)
│
├─ OBJECT STORE: userDetails
│  ├─ keyPath: its_id (unique)
│  ├─ Index: lookup_time
│  └─ Stores:
│     ├─ its_id (key)
│     ├─ user (all user fields)
│     ├─ takhmeen (array of contributions)
│     ├─ payments (array of receipts)
│     ├─ summary (totals)
│     └─ lookup_time (indexed)
│
├─ OBJECT STORE: stats
│  ├─ keyPath: timestamp (unique)
│  └─ Stores:
│     ├─ timestamp (key)
│     ├─ users.totalUsers
│     ├─ users.totalBilled
│     ├─ users.totalPaid
│     ├─ receipts.totalReceived
│     └─ receipts.totalPending
│
└─ OBJECT STORE: syncQueue
   ├─ keyPath: id (auto-increment)
   ├─ Index: synced (false = pending)
   └─ Stores:
      ├─ id (key)
      ├─ action (e.g., "upload")
      ├─ data (form data to sync)
      ├─ endpoint (where to send)
      ├─ timestamp (when queued)
      ├─ synced (boolean)
      └─ attempts (retry count)
```

---

## 7. Network Timing & Timeouts

```
REQUEST STARTS
│
├─ AUTH ENDPOINT (/api/admin/login)
│  └─ NETWORK-ONLY (no timeout limit)
│     ├─ Waiting... (30s max allowed by fetchWithTimeout)
│     └─ Response → Return immediately
│
├─ STATIC ASSET (.css, .js, .png)
│  └─ CACHE-FIRST
│     ├─ Cache hit? → Return immediately (0ms)
│     └─ Cache miss?
│        └─ Network-first with 30s timeout
│           ├─ Success → Cache & return
│           └─ Timeout → Offline response
│
├─ API CALL (/api/admin/users)
│  └─ NETWORK-FIRST with 5s timeout
│     ├─ Success (< 5s) → Cache & return
│     ├─ Timeout (> 5s) → Check cache
│     │  ├─ Found → Return stale data
│     │  └─ Not found → Return offline response
│     └─ Error → Check cache
│        ├─ Found → Return stale data
│        └─ Not found → Return offline response
│
└─ NAVIGATION (to page)
   └─ CACHE-FIRST
      ├─ Cache hit? → Return immediately
      └─ Cache miss?
         └─ Fetch from network (30s timeout)
            ├─ Success → Cache & return
            └─ Fail → Return offline page
```

---

## 8. User Journey: Offline Experience

```
SCENARIO: User loses internet connection while using admin dashboard
│
TIME 0:00
├─ User viewing users table (cached in memory)
├─ Table shows data from previous network request
└─ User is connected ✓
│
TIME 0:30
├─ ISP connection drops (User doesn't notice yet)
├─ User clicks "Refresh" or navigates
└─ App attempts network request
│
TIME 0:35
├─ Service Worker intercepts request
├─ Network-first strategy activates
├─ Request sent but timeout at 5s
├─ Cache checked
│
TIME 0:40
├─ Cached data found in Cache API or IndexedDB
├─ Stale data returned to page
├─ Page renders
├─ Offline indicator badge shows: "📭 Showing cached data (3 hours ago)"
└─ User can read their account info ✓
│
TIME 2:00 - User goes to lunch
├─ Connection still down
├─ User can still browse cached pages
└─ Only lookup new accounts fails
│
TIME 3:00 - Connection restored
├─ User sees "Back online!" notification
├─ Click "Refresh" or wait for automatic refresh
├─ Network requests succeed
├─ Fresh data displayed
└─ Offline badges removed
```

---

## 9. Admin Upload Queue (Phase 2)

```
ADMIN UPLOADS EXCEL FILE
│
├─ ONLINE?
│  │
│  YES → FormData sent to /api/admin/upload
│       ├─ Success → Show success message
│       └─ Error → Show error
│
└─ OFFLINE?
   └─ File queued in IndexedDB:
      │
      ├─ Store in syncQueue:
      │  ├─ action: "upload"
      │  ├─ data: <FormData object>
      │  ├─ endpoint: "/api/admin/upload"
      │  ├─ timestamp: Date.now()
      │  ├─ synced: false
      │  └─ attempts: 0
      │
      └─ Show: "✓ Upload queued. Will sync when online."
         │
         └─ USER GOES ONLINE
            │
            ├─ Background sync triggered (or manual sync)
            ├─ For each queued upload:
            │  ├─ Send to server
            │  ├─ Success? → Mark as synced, remove from queue
            │  └─ Error? → Retry up to 3 times
            │
            └─ Show: "✓ All uploads synced!"
```

---

## 10. Multi-Device Install State

```
DEVICE 1: ADMIN PHONE
├─ Installed: YES
├─ State: pwa-installed (CSS class added)
├─ Install banner: HIDDEN
├─ Mode: standalone
└─ Address bar: HIDDEN
   
DEVICE 2: ADMIN TABLET
├─ Installed: NO
├─ State: browser
├─ Install banner: SHOWN
├─ Mode: browser
└─ Address bar: VISIBLE

DEVICE 3: USER PHONE
├─ Installed: YES (user portal)
├─ State: pwa-installed
├─ Install banner: HIDDEN
├─ Mode: standalone
└─ Manifest: /user/manifest.json

DEVICE 4: DESKTOP CHROME
├─ Installed: NO
├─ State: browser
├─ Install banner: SHOWN
│  (But browser may not support desktop install)
├─ Mode: browser
└─ Icon: Website shortcut possible
```

---

## 11. Cache Invalidation Strategy

```
CURRENT: v1

scenario 1: SMALL UPDATE (CSS tweak)
├─ Edit shared.css in src
├─ Commit to git
├─ Vercel deploys new version
├─ Service Worker still serves cached v1
├─ User doesn't see changes ✗
│
└─ FIX: Update CACHE_VERSION
   ├─ Change 'v1' → 'v2' in service-worker.js
   ├─ Commit & push
   ├─ Next page load: SW detects new version
   ├─ ACTIVATE event deletes v1 cache
   ├─ Creates v2 cache
   ├─ New CSS served
   └─ User sees changes ✓

scenario 2: WHEN TO UPDATE VERSION
├─ HTML changes → Update version
├─ CSS changes → Update version
├─ JS changes → Update version
├─ Asset changes (images, icons) → Update version
└─ DO NOT update → Only for minor server-side changes
   (that don't affect client files)
```

---

## 12. Error Handling Flow

```
FETCH REQUEST FAILS
│
├─ TIMEOUT (Network too slow)
│  ├─ For API: Check cache after 5s
│  │  ├─ Found → Return stale
│  │  └─ Not found → Return offline error JSON
│  │
│  └─ For static: Retry or return offline page
│
├─ 404 NOT FOUND
│  ├─ Propagate error to page
│  ├─ Page displays: "❌ Account not found"
│  └─ Offer: Try offline cache or search again
│
├─ 500 SERVER ERROR
│  ├─ Try cache (if available)
│  ├─ Show: "❌ Server error. Showing cached data."
│  └─ User can still view offline
│
├─ NETWORK UNREACHABLE (Offline)
│  ├─ Service Worker catches
│  ├─ Check cache
│  ├─ Not found → Return:
│  │  JSON: { error: "You are offline", offline: true }
│  │  OR HTML: offline fallback page
│  └─ Page shows: "📡 Offline. Features unavailable"
│
└─ SERVICE WORKER ERROR
   ├─ Log to console: [SW] error
   ├─ Fallback: Treat as network error
   └─ User sees: Generic offline message
```

---

## 13. Storage Quota Management

```
TYPICAL USAGE
│
├─ Static Cache (CSS, JS, HTML): ~100 KB
├─ API Cache (User data): ~20-50 KB
├─ IndexedDB (Cached users): ~100-500 KB
│  ├─ 100 users × 1-2 KB each = ~100-200 KB
│  └─ 1000 users × 1-2 KB each = ~1-2 MB
│
├─ Total: ~200-300 KB (small installations)
│        to ~2-3 MB (large installations)
│
└─ Browser Quota: ~50 MB (typical)
   └─ Room for ~20-100 cached user datasets
      
CLEANUP STRATEGY
├─ After 30 days: Auto-delete old data
├─ Check before sync: Warn if < 1 MB free
└─ Manual: Clear via DevTools if needed
```

---

## Key Metrics to Monitor

| Metric | What to Watch | Target |
|--------|---------------|--------|
| Cache Hit Rate | % of requests from cache | > 80% |
| Time to Interactive | Load time after install | < 2s |
| TTL (Time-to-Live) | How long data stays cached | 30 days |
| Storage Used | Total IndexedDB + Cache | < 5 MB |
| Install Rate | % users who install | > 10-30% |
| Offline Usage | % requests while offline | > 5% |
| Update Frequency | How often cache version changes | Monthly |

---

**This architecture ensures:**
- ✓ Users can work offline
- ✓ App works without network
- ✓ Installation directly from browser
- ✓ Fast load times with cache-first strategy
- ✓ Data freshness with network-first for APIs
- ✓ Graceful degradation when offline
- ✓ Automatic cleanup of old data
- ✓ Multiple entry points (admin/user portals)

