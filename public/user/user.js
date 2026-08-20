const lookupForm = document.getElementById('lookupForm');
const lookupCard = document.getElementById('lookupCard');
const resultArea = document.getElementById('resultArea');
const lookupError = document.getElementById('lookupError');
let currentItsId = null;

// App version - update when deploying new features
const APP_VERSION = '1.2.0'; // After adding tracking + notifications

// ========== APP UPDATE CHECK ==========
async function checkForAppUpdate(itsId) {
  try {
    const res = await fetch('/api/app/check-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userVersion: APP_VERSION,
        itsId: itsId,
        appType: 'user'
      })
    });

    if (!res.ok) return;

    const data = await res.json();

    if (data.hasUpdate) {
      displayUpdateBanner(data);
    }

    // Store version check timestamp
    localStorage.setItem('lastVersionCheck', new Date().toISOString());
  } catch (err) {
    console.warn('Failed to check for app update:', err);
  }
}

function displayUpdateBanner(updateData) {
  const container = document.getElementById('notificationsContainer');
  if (!container) return;

  let bannerColor = '#f59e0b'; // orange
  let icon = '📦';

  if (updateData.updateRequired) {
    bannerColor = '#dc2626'; // red - critical
    icon = '⚠️';
  }

  const banner = document.createElement('div');
  banner.className = 'notification-banner';
  banner.style.background = `linear-gradient(135deg, ${bannerColor} 0%, ${bannerColor}dd 100%)`;
  banner.innerHTML = `
    <h4>${icon} App Update Available</h4>
    <p>${updateData.updateMessage}</p>
    ${updateData.updateFeatures && updateData.updateFeatures.length > 0 ? `
      <div style="margin-top: 8px; font-size: 12px;">
        <strong>What's New:</strong><br>
        ${updateData.updateFeatures.map(f => `• ${f}`).join('<br>')}
      </div>
    ` : ''}
    <div style="margin-top: 12px;">
      <button onclick="location.reload();" style="
        background: white;
        color: ${updateData.updateRequired ? '#dc2626' : '#f59e0b'};
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
      ">🔄 Refresh to Update</button>
      <button onclick="this.parentElement.parentElement.style.display='none'" style="
        background: rgba(255,255,255,0.2);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-left: 8px;
      ">Later</button>
    </div>
    <button class="close-btn" onclick="this.parentElement.style.display='none';">✕</button>
  `;

  container.insertBefore(banner, container.firstChild);

  // Auto-hide after 15 seconds if not required
  if (!updateData.updateRequired) {
    setTimeout(() => {
      if (banner.parentElement) {
        banner.style.opacity = '0';
        banner.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          banner.style.display = 'none';
        }, 300);
      }
    }, 15000);
  }
}

// ========== PUSH NOTIFICATIONS SYSTEM ==========

// Check for notifications periodically (every 30 seconds)
async function startPeriodicNotificationCheck(itsId) {
  if (!('serviceWorker' in navigator)) return;

  // Initial check
  await checkNotificationsViaServiceWorker(itsId);

  // Periodic check every 30 seconds
  setInterval(() => {
    checkNotificationsViaServiceWorker(itsId);
  }, 30 * 1000);

}

async function checkNotificationsViaServiceWorker(itsId) {
  try {
    // Tell Service Worker to check
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CHECK_NOTIFICATIONS',
        itsId: itsId
      });
    }

    // Also do direct check
    const res = await fetch(`/api/notifications/${encodeURIComponent(itsId)}`);
    if (!res.ok) return;

    const data = await res.json();

    // Show any unread notifications as in-app banners
    if (data.notifications && data.unreadCount > 0) {
      data.notifications.forEach(notif => {
        if (notif.is_unread && !localStorage.getItem(`notif_shown_${notif.id}`)) {
          // Show in-app banner
          displayNotificationBanner({
            title: notif.title,
            message: notif.message,
            notificationId: notif.id
          });
          localStorage.setItem(`notif_shown_${notif.id}`, 'true');
        }
      });
    }
  } catch (err) {
    console.warn('Notification check failed:', err);
  }
}

function displayNotificationBanner(notif) {
  const container = document.getElementById('notificationsContainer');
  if (!container) return;

  const banner = document.createElement('div');
  banner.className = 'notification-banner';
  banner.style.background = 'linear-gradient(135deg, #3c7441 0%, #2d5a34 100%)';
  banner.innerHTML = `
    <h4>🔔 ${escapeHtml(notif.title)}</h4>
    <p>${escapeHtml(notif.message)}</p>
    <button class="close-btn" onclick="this.parentElement.style.display='none'; markNotificationAsRead('${currentItsId}', ${notif.notificationId});">✕</button>
  `;

  container.insertBefore(banner, container.firstChild);

  // Auto-mark as read after 2 seconds
  setTimeout(() => {
    markNotificationAsRead(currentItsId, notif.notificationId);
  }, 2000);

  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (banner.parentElement) {
      banner.style.display = 'none';
    }
  }, 10000);
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  // Request permission
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

async function registerForPushNotifications(itsId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    // Register service worker if not already registered
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });

    // Subscribe to push notifications
    // Note: This is a simplified implementation
    // In production, you'd use a VAPID key from your server
    try {
      // For now, we'll just note that the user has enabled notifications
      // The server can send notifications via the API
      const hasPermission = Notification.permission === 'granted';
      if (hasPermission) {
        // Store preference in localStorage
        localStorage.setItem(`notifications_enabled_${itsId}`, 'true');
        return true;
      }
    } catch (err) {
      console.warn('Push subscription not available:', err.message);
      // Fallback to polling for notifications (done via regular fetch)
      localStorage.setItem(`notifications_enabled_${itsId}`, 'true');
      return true;
    }
  } catch (err) {
    console.error('Error registering for push:', err);
    return false;
  }
}

async function checkAndRequestNotificationPermission(itsId) {
  if (Notification.permission === 'denied') {
    // User has blocked notifications - show info banner
    displayNotificationPermissionBanner('blocked');
    return;
  }

  if (Notification.permission === 'granted') {
    // Already have permission
    await registerForPushNotifications(itsId);
    return;
  }

  // Permission is 'default' - show permission banner
  displayNotificationPermissionBanner('prompt', itsId);
}

function displayNotificationPermissionBanner(status, itsId) {
  const container = document.getElementById('notificationsContainer');
  if (!container) return;

  let banner;

  if (status === 'prompt') {
    banner = document.createElement('div');
    banner.className = 'notification-banner';
    banner.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    banner.innerHTML = `
      <h4>🔔 Enable Push Notifications</h4>
      <p>Get notified instantly about important updates even when you're not using the app.</p>
      <button onclick="enablePushNotifications('${itsId}')" style="
        background: white;
        color: #2563eb;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
        margin-top: 8px;
      ">✓ Enable Notifications</button>
      <button onclick="this.parentElement.style.display='none'" style="
        background: rgba(255,255,255,0.2);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 8px;
        margin-left: 8px;
      ">Later</button>
      <button class="close-btn" onclick="this.parentElement.style.display='none';">✕</button>
    `;
  } else if (status === 'blocked') {
    banner = document.createElement('div');
    banner.className = 'notification-banner';
    banner.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    banner.innerHTML = `
      <h4>🔕 Notifications Blocked</h4>
      <p>You've blocked notifications. <a href="#" onclick="openNotificationSettings(); return false;" style="color: white; text-decoration: underline;">Enable in settings</a> to get updates.</p>
      <button class="close-btn" onclick="this.parentElement.style.display='none';">✕</button>
    `;
  }

  if (banner) {
    container.insertBefore(banner, container.firstChild);

    // Auto-hide after 10 seconds if not interacted
    setTimeout(() => {
      if (banner.parentElement) {
        banner.style.display = 'none';
      }
    }, 10000);
  }
}

async function enablePushNotifications(itsId) {
  const permission = await requestNotificationPermission();
  if (permission) {
    await registerForPushNotifications(itsId);
    // Show success message
    const msgEl = document.createElement('div');
    msgEl.className = 'notification-banner';
    msgEl.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    msgEl.innerHTML = `
      <h4>✅ Notifications Enabled</h4>
      <p>You'll now receive notifications for important updates!</p>
      <button class="close-btn" onclick="this.parentElement.style.display='none';">✕</button>
    `;
    document.getElementById('notificationsContainer').insertBefore(msgEl, document.getElementById('notificationsContainer').firstChild);

    // Hide after 5 seconds
    setTimeout(() => {
      msgEl.style.display = 'none';
    }, 5000);
  }
}

function openNotificationSettings() {
  alert('To enable notifications:\n\n1. Click the lock/info icon in the address bar\n2. Find "Notifications" setting\n3. Select "Allow"\n\nThen refresh this page.');
}

// ========== NOTIFICATIONS ==========
async function loadAndDisplayNotifications(itsId) {
  try {
    const res = await fetch(`/api/notifications/${encodeURIComponent(itsId)}`);
    if (!res.ok) return;

    const data = await res.json();
    const container = document.getElementById('notificationsContainer');
    if (!container) return;

    if (!data.notifications || data.notifications.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Display unread notifications
    const unreadNotifications = data.notifications.filter(n => n.is_unread);
    if (unreadNotifications.length > 0) {
      unreadNotifications.forEach((notif, index) => {
        const banner = document.createElement('div');
        banner.className = 'notification-banner';
        banner.innerHTML = `
          <h4>🔔 ${escapeHtml(notif.title)}</h4>
          <p>${escapeHtml(notif.message)}</p>
          <button class="close-btn" onclick="this.parentElement.style.display='none'; markNotificationAsRead('${itsId}', ${notif.id});">✕</button>
        `;
        container.appendChild(banner);

        // Mark as read after 2 seconds (when user sees it)
        setTimeout(() => {
          markNotificationAsRead(itsId, notif.id);
        }, 2000);
      });
    }
  } catch (err) {
    console.warn('Failed to load notifications:', err);
  }
}

async function markNotificationAsRead(itsId, notificationId) {
  try {
    await fetch(`/api/notifications/${encodeURIComponent(itsId)}/${notificationId}/read`, {
      method: 'POST'
    });
  } catch (err) {
    console.warn('Failed to mark notification as read:', err);
  }
}

function currency(n) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function showError(message) {
  if (!lookupError) return;
  lookupError.textContent = message;
  lookupError.className = 'error';
  lookupError.style.display = 'block';
  lookupError.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideError() {
  lookupError.style.display = 'none';
  lookupError.textContent = '';
}

lookupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const uniqueNumber = document.getElementById('uniqueNumber').value.trim().toUpperCase();
  const submitBtn = lookupForm.querySelector('button');

  hideError();

  if (!uniqueNumber) {
    showError('❌ Please enter your ITS ID.');
    return;
  }

  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="loading-spinner"></span> Checking...';

  try {
    const res = await fetchWithTimeout(`/api/user/${encodeURIComponent(uniqueNumber)}`);
    const data = await res.json();

    if (!res.ok) {
      showError('❌ ' + (data.error || 'Account not found. Please verify your ITS ID and try again.'));
      return;
    }

    renderResult(data);
  } catch (err) {
    showError('❌ ' + (err.message || 'Network error. Please check your connection and try again.'));
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
});

document.getElementById('searchAgainBtn').addEventListener('click', () => {
  resultArea.style.display = 'none';
  lookupCard.style.display = 'block';
  document.getElementById('uniqueNumber').value = '';
  hideError();
  document.getElementById('uniqueNumber').focus();
});

// Add Enter key support and auto-uppercase ITS ID
document.getElementById('uniqueNumber').addEventListener('keyup', (e) => {
  e.target.value = e.target.value.toUpperCase();
});

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderResult(data) {
  if (!data || !data.user) {
    showError('❌ Invalid data received. Please try again.');
    return;
  }

  const { user, takhmeen = [], payments = [], summary = {}, tracking = {} } = data;

  // Store current ITS ID and load notifications
  currentItsId = user.its_id;
  loadAndDisplayNotifications(currentItsId);

  // Start periodic notification checks (every 30 seconds)
  startPeriodicNotificationCheck(currentItsId);

  // Check for app updates
  checkForAppUpdate(currentItsId);

  // Check and request notification permission
  checkAndRequestNotificationPermission(currentItsId);

  // Populate user info
  const resNameEl = document.getElementById('resName');
  if (!resNameEl) {
    showError('❌ Error loading page. Please refresh.');
    return;
  }
  resNameEl.textContent = user?.name || 'Unknown User';

  const metaParts = [];
  if (user.its_id) metaParts.push(`ITS ID: ${escapeHtml(user.its_id)}`);
  if (user.mobile) metaParts.push(`📱 ${escapeHtml(user.mobile)}`);
  if (user.city) metaParts.push(`📍 ${escapeHtml(user.city)}`);

  // Add tracking information to meta
  if (tracking.lastPaymentUpdate) {
    const lastUpdate = formatDateTime(tracking.lastPaymentUpdate);
    metaParts.push(`📅 Last updated: ${lastUpdate}`);
  }

  document.getElementById('resMeta').textContent = metaParts.join(' • ') || 'Account information';

  // Display tracking information
  const trackingMeta = document.getElementById('trackingMeta');
  if (trackingMeta && tracking) {
    const trackingParts = [];

    if (tracking.totalFetches) {
      trackingParts.push(`✓ Checked ${tracking.totalFetches} time${tracking.totalFetches !== 1 ? 's' : ''}`);
    }

    if (tracking.lastPaymentUpdate) {
      trackingParts.push(`📊 Payments last updated: ${formatDateTime(tracking.lastPaymentUpdate)}`);
    }

    if (tracking.lastTakhmeeUpdate) {
      trackingParts.push(`💚 Takhmeen last updated: ${formatDateTime(tracking.lastTakhmeeUpdate)}`);
    }

    if (trackingParts.length > 0) {
      trackingMeta.innerHTML = trackingParts.join('<br>');
    }
  }

  // Update statistics with Takhmeen and payment data
  // Show Takhmeen total, received and pending from payment receipts
  const totalBilled = summary.totalBilled || 0;
  const totalReceived = summary.totalReceived || 0;
  const totalPending = summary.totalPending || 0;

  // Populate stats with null checks
  const statTakhmeen = document.getElementById('statTakhmeen');
  const statReceived = document.getElementById('statReceived');
  const statPending = document.getElementById('statPending');
  const statPreviousDue = document.getElementById('statPreviousDue');

  if (statTakhmeen) statTakhmeen.textContent = currency(totalBilled);
  if (statReceived) statReceived.textContent = currency(totalReceived);
  if (statPending) statPending.textContent = currency(totalPending);
  if (statPreviousDue) statPreviousDue.textContent = currency(summary.totalPreviousDue || 0);

  // Hide skeleton and show actual stats
  const statsContainer = document.getElementById('statsContainer');
  const statsRow = document.getElementById('statsRow');
  if (statsContainer) statsContainer.style.display = 'none';
  if (statsRow) statsRow.style.display = 'grid';

  // Create progress bar for pending amounts
  const statPendingDiv = document.querySelector('.stat:nth-child(2)');
  if (statPendingDiv) {
    const totalContribution = totalReceived + totalPending;
    const percentReceived = totalContribution > 0 ? Math.round((totalReceived / totalContribution) * 100) : 0;

    const progressBar = document.createElement('div');
    progressBar.style.marginTop = '12px';
    progressBar.style.height = '6px';
    progressBar.style.background = 'rgba(59,130,246,0.1)';
    progressBar.style.borderRadius = '3px';
    progressBar.style.overflow = 'hidden';

    const progressFill = document.createElement('div');
    progressFill.style.height = '100%';
    progressFill.style.width = percentReceived + '%';
    progressFill.style.background = 'linear-gradient(90deg, var(--green), var(--cyan))';
    progressFill.style.borderRadius = '3px';
    progressFill.style.transition = 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';

    progressBar.appendChild(progressFill);

    const oldBar = statPendingDiv.querySelector('[data-progress]');
    if (oldBar) oldBar.remove();

    progressBar.setAttribute('data-progress', 'true');
    statPendingDiv.appendChild(progressBar);

    // Add percentage label
    const percentLabel = document.createElement('p');
    percentLabel.style.margin = '8px 0 0 0';
    percentLabel.style.fontSize = '12px';
    percentLabel.style.color = '#64748b';
    percentLabel.textContent = `${percentReceived}% collected`;
    statPendingDiv.appendChild(percentLabel);
  }

  // Populate takhmeen contributions table
  const takhmeenBody = document.getElementById('takhmeenBody');
  const emptyTakhmeen = document.getElementById('emptyTakhmeen');

  if (takhmeenBody && emptyTakhmeen) {
    takhmeenBody.innerHTML = '';

    if (!takhmeen || takhmeen.length === 0) {
      emptyTakhmeen.style.display = 'block';
    } else {
      emptyTakhmeen.style.display = 'none';
      takhmeen.forEach((t, index) => {
        const tr = document.createElement('tr');
        tr.style.animation = `slideUp 0.4s ease-out ${index * 0.05}s backwards`;
        tr.innerHTML = `
          <td>${escapeHtml(t.takhmeen_yr || '-')}</td>
          <td style="text-align: right; color: var(--green); font-weight: 600;">₹${currency(t.takhmeen_amt || 0)}</td>
          <td style="text-align: right; color: var(--amber); font-weight: 600;">₹${currency(t.previous_amount_due || 0)}</td>
          <td>${escapeHtml(t.comment || '-')}</td>
        `;
        takhmeenBody.appendChild(tr);
      });
    }
  }

  // Populate payment receipts table
  const receiptsBody = document.getElementById('receiptsBody');
  const emptyReceipts = document.getElementById('emptyReceipts');

  // Safety check: only proceed if elements exist
  if (receiptsBody && emptyReceipts) {
    receiptsBody.innerHTML = '';

    if (!payments || payments.length === 0) {
      emptyReceipts.style.display = 'block';
    } else {
      emptyReceipts.style.display = 'none';
      payments.forEach((p, index) => {
        const tr = document.createElement('tr');
        const receiptDate = p.received_date ? new Date(p.received_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

        tr.style.animation = `slideUp 0.4s ease-out ${index * 0.05}s backwards`;
        tr.innerHTML = `
          <td><strong>${escapeHtml(p.receipt_no || '-')}</strong></td>
          <td>${receiptDate}</td>
          <td style="text-align: right; color: var(--green); font-weight: 600;">₹${currency(p.amt_rcv || 0)}</td>
          <td>${escapeHtml(p.payment_mode || '-')}</td>
          <td style="text-align: right; color: var(--amber); font-weight: 600;">₹${currency(p.amt_pending || 0)}</td>
          <td>${escapeHtml(p.payment_refrence || '-')}</td>
        `;
        receiptsBody.appendChild(tr);
      });
    }
  }

  // Show results with smooth animation
  lookupCard.style.display = 'none';
  resultArea.style.display = 'block';
  resultArea.style.animation = 'slideUp 0.5s ease-out';
  resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getStatusIcon(status) {
  const icons = {
    'paid': '✅',
    'partial': '⚠️',
    'pending': '⏳'
  };
  return icons[status] || '❓';
}
