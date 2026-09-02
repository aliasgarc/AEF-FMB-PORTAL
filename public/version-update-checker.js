// Version Update Checker - Shows notification if new version available
async function checkForUpdates() {
  try {
    const currentVersion = document.querySelector('meta[name="app-version"]')?.content;
    if (!currentVersion) return;

    const response = await fetch('/api/app/version');
    if (!response.ok) return;

    const data = await response.json();
    const latestVersion = data.version;

    if (currentVersion !== latestVersion) {
      showUpdateNotification(currentVersion, latestVersion);
    }
  } catch (err) {
    console.warn('[Version Check] Could not check for updates:', err);
  }
}

function showUpdateNotification(currentVersion, latestVersion) {
  // Check if user dismissed in THIS session only (sessionStorage)
  const dismissedThisSession = sessionStorage.getItem('dismissedUpdateVersion');
  if (dismissedThisSession === latestVersion) {
    console.log('[Update Checker] Update dismissed this session, not showing');
    return;
  }

  // Remove existing notification if any
  const existingNotification = document.getElementById('versionUpdateNotification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification banner
  const notification = document.createElement('div');
  notification.id = 'versionUpdateNotification';
  notification.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    padding: 16px 24px;
    box-shadow: 0 10px 30px rgba(217, 119, 6, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    z-index: 9999;
    font-size: 14px;
    backdrop-filter: blur(10px);
    animation: slideDown 0.4s ease-out;
  `;

  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
      <span style="font-size: 20px;">🔄</span>
      <div>
        <strong style="font-weight: 700;">New Version Available!</strong>
        <div style="font-size: 13px; opacity: 0.95; margin-top: 2px;">
          Update from v${currentVersion} → v${latestVersion} for latest features
        </div>
      </div>
    </div>
    <div style="display: flex; gap: 8px; white-space: nowrap;">
      <button id="updateNowBtn" style="
        background: white;
        color: #d97706;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.3s ease;
      " onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
        Update Now
      </button>
      <button id="dismissUpdateBtn" style="
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.3s ease;
      " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
        Later
      </button>
    </div>
  `;

  document.body.insertBefore(notification, document.body.firstChild);

  // Update Now button - clear cache, update app, remove notification
  document.getElementById('updateNowBtn').addEventListener('click', async () => {
    const updateBtn = document.getElementById('updateNowBtn');
    const dismissBtn = document.getElementById('dismissUpdateBtn');

    // Disable buttons during update
    updateBtn.disabled = true;
    dismissBtn.disabled = true;
    updateBtn.textContent = '⏳ Updating...';

    // Clear localStorage/sessionStorage for dismissed updates
    localStorage.removeItem('dismissedUpdateVersion');
    sessionStorage.removeItem('dismissedUpdateVersion');

    try {
      // Clear all service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[Update Checker] Cleared all caches');
      }

      // Clear sessionStorage (fresh start)
      sessionStorage.clear();

      // Hard reload to fetch fresh content
      console.log('[Update Checker] Reloading with fresh cache...');
      window.location.replace(window.location.href);
    } catch (err) {
      console.error('[Update Checker] Error during update:', err);
      updateBtn.textContent = 'Update Now';
      updateBtn.disabled = false;
      dismissBtn.disabled = false;
    }
  });

  // Later button - dismiss for THIS SESSION ONLY
  document.getElementById('dismissUpdateBtn').addEventListener('click', () => {
    // Only dismiss for current session (not persistent)
    sessionStorage.setItem('dismissedUpdateVersion', latestVersion);

    notification.style.animation = 'slideUp 0.4s ease-out forwards';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 400);

    console.log('[Update Checker] Update dismissed for this session. Will show again on next app open.');
  });
}

// Add slideDown animation if not already in CSS
if (!document.querySelector('style[data-version-checker]')) {
  const style = document.createElement('style');
  style.setAttribute('data-version-checker', 'true');
  style.textContent = `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-100%);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideUp {
      from {
        opacity: 1;
        transform: translateY(0);
      }
      to {
        opacity: 0;
        transform: translateY(-100%);
      }
    }
  `;
  document.head.appendChild(style);
}

// Update checking is now handled by checkForAppUpdate() in user.js
// This version-update-checker.js is kept for backward compatibility but not auto-run
// console.log('[Update Checker] Initialized - disabled in favor of user.js update handling');
