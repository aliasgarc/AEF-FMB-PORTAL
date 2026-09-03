// Service Worker for PWA offline support
// Version is set via CACHE_VERSION query param from app (e.g., ?v=1.2.0)
// This ensures cache is invalidated when app version changes
const urlParams = new URLSearchParams(self.location.search);
const CACHE_VERSION = urlParams.get('v') || 'default';
const CACHE_NAME = `payment-tracker-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline.html';

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/shared.css',
  '/offline.html',
  '/admin/login.html',
  '/admin/dashboard.html',
  '/admin/admin.js',
  '/user/index.html',
  '/user/user.js',
  '/fmb-logo.png'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching assets');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.log('[ServiceWorker] Some assets failed to cache:', err);
        // Continue even if some assets fail
        return PRECACHE_ASSETS.reduce((promise, asset) => {
          return promise.then(() =>
            cache.add(asset).catch(() => console.log(`Failed to cache ${asset}`))
          );
        }, Promise.resolve());
      });
    })
  );
  // Don't skip waiting - let controlled update handle activation
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network first for API, Cache first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Allow all POST/PUT/DELETE requests to bypass service worker (let browser handle them directly)
  // This prevents caching and timeout issues for file uploads and mutations
  if (request.method !== 'GET') {
    return;
  }

  // API requests - Network first with timeout (but skip upload endpoints)
  if (url.pathname.startsWith('/api/')) {
    // Don't apply timeout to upload endpoints
    const isUploadEndpoint = url.pathname.includes('/upload');

    const fetchPromise = fetch(request);

    if (isUploadEndpoint) {
      // For uploads, use no timeout - let it complete naturally
      event.respondWith(
        fetchPromise.then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response('Network error - No cached data available', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
        })
      );
    } else {
      // For other API requests, apply 5-second timeout
      event.respondWith(
        Promise.race([
          fetchPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            if (request.mode === 'navigate') {
              return caches.match(OFFLINE_PAGE);
            }
            // Return JSON error for API requests
            return new Response(JSON.stringify({
              error: 'Network offline - No cached data available. Please check your internet connection.'
            }), {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
      );
    }
    return;
  }

  // Static assets - Cache first
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(request).then((response) => {
        // Cache successful responses
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        console.log('[ServiceWorker] Fetch failed, returning offline page');
        return caches.match(OFFLINE_PAGE);
      });
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ========== PUSH NOTIFICATIONS ==========
// Handle all push notifications (admin targeted and app updates)
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] 🔔 PUSH NOTIFICATION RECEIVED!', event);
  console.log('[ServiceWorker] Event data:', event.data);

  if (!event.data) {
    console.log('[ServiceWorker] No data in push event');
    return;
  }

  try {
    console.log('[ServiceWorker] Attempting to parse push data...');
    const data = event.data.json();
    console.log('[ServiceWorker] Parsed push data:', data);

    const {
      title = '🔔 Notification',
      message = 'You have a new message',
      push_notification_id,
      its_id,
      message_type = 'custom'
    } = data;

    console.log('[ServiceWorker] Notification details:', { title, message, push_notification_id, its_id });

    // Format notification based on message type
    let notificationTitle = title;
    let notificationBody = message;

    const notificationOptions = {
      body: notificationBody,
      icon: '/fmb-logo-192.png',
      badge: '/fmb-logo-192.png',
      tag: `push-notification-${push_notification_id || Date.now()}`,
      requireInteraction: false,
      data: {
        push_notification_id,
        its_id,
        message_type,
        url: '/user/'
      },
      actions: [
        {
          action: 'open',
          title: '📖 Open',
          icon: '/fmb-logo-192.png'
        },
        {
          action: 'close',
          title: 'Dismiss',
          icon: '/fmb-logo-192.png'
        }
      ]
    };

    // Log notification details
    console.log(`[ServiceWorker] Showing push notification:`, {
      title: notificationTitle,
      message: notificationBody,
      type: message_type,
      to_user: its_id
    });

    // Broadcast to open clients for in-page display
    const notificationData = {
      title: notificationTitle,
      message: notificationBody,
      push_notification_id,
      its_id,
      message_type
    };
    broadcastNotification(notificationData);

    event.waitUntil(
      self.registration.showNotification(notificationTitle, notificationOptions)
        .then(() => {
          // Report delivery status to server
          if (push_notification_id && its_id) {
            fetch('/api/push/mark-delivered', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                push_notification_id,
                its_id
              })
            }).catch(err => console.warn('[ServiceWorker] Could not report delivery:', err));
          }
        })
    );
  } catch (err) {
    console.error('[ServiceWorker] Error handling push:', err);
    // Fallback notification
    event.waitUntil(
      self.registration.showNotification('🔔 FMB Notification', {
        body: 'You have a new notification from the system',
        icon: '/fmb-logo-192.png',
        badge: '/fmb-logo-192.png',
        requireInteraction: false
      })
    );
  }
});

// Send push notification to all open clients
async function broadcastNotification(data) {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    console.log('[ServiceWorker] Sending notification to client:', client.url);
    client.postMessage({
      type: 'PUSH_NOTIFICATION',
      payload: data
    });
  });
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked:', event.action);
  event.notification.close();

  const notificationData = event.notification.data || {};
  const { push_notification_id, its_id } = notificationData;

  // Don't open for "close" action
  if (event.action === 'close') {
    return;
  }

  // Mark as read when user clicks
  if (push_notification_id && its_id) {
    fetch('/api/push/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        push_notification_id,
        its_id
      })
    }).catch(err => console.warn('[ServiceWorker] Could not mark as read:', err));
  }

  // Open the app and go to user portal
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url === '/' || client.url.includes('/user/')) {
          client.focus();
          return client;
        }
      }
      // If not open, open new window
      return clients.openWindow('/user/');
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[ServiceWorker] Notification closed:', event.notification.tag);
  const notificationId = event.notification.data?.notificationId;
  if (notificationId) {
    // Optionally, mark as read when user closes notification
    // (This is optional and depends on your use case)
  }
});

// ========== PERIODIC NOTIFICATION CHECK ==========
// Check for new notifications every 5 minutes (even when app closed)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_NOTIFICATIONS') {
    checkForNewNotifications(event.data.itsId);
  }
});

async function checkForNewNotifications(itsId) {
  if (!itsId) return;

  try {
    const res = await fetch(`/api/notifications/${encodeURIComponent(itsId)}`);
    if (!res.ok) return;

    const data = await res.json();

    if (data.notifications && data.unreadCount > 0) {
      // Show notification for unread items
      data.notifications.forEach(notif => {
        if (notif.is_unread) {
          console.log(`[ServiceWorker] Showing notification: ${notif.title}`);
          self.registration.showNotification(notif.title, {
            body: notif.message,
            icon: '/fmb-logo-192.png',
            badge: '/fmb-logo-192.png',
            tag: `notification-${notif.id}`,
            requireInteraction: true,
            data: {
              notificationId: notif.id,
              url: '/user/'
            }
          });
        }
      });
    }
  } catch (err) {
    console.warn('[ServiceWorker] Failed to check notifications:', err);
  }
}

// Periodically check for notifications (every 5 minutes)
setInterval(() => {
  console.log('[ServiceWorker] Periodic notification check');
  // Get itsId from IndexedDB or localStorage
  if (typeof self.clients !== 'undefined') {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'REQUEST_ITS_ID'
        });
      });
    });
  }
}, 5 * 60 * 1000); // 5 minutes

console.log('[ServiceWorker] Loaded with periodic notification checks');
