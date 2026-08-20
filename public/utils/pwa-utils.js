/**
 * PWA Utilities - Detection and version checking
 * Provides methods to check app installation status and handle updates
 */
const PWAUtils = {
  /**
   * Check if app is installed (running as PWA)
   * Works on Android, iOS, Windows, Linux, Mac
   */
  isInstalled() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  },

  /**
   * Get detailed installation status
   * Returns object with installation details
   */
  getInstallationStatus() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = window.navigator.standalone === true;
    const isAndroid = document.referrer.includes('android-app://');

    return {
      isInstalled: this.isInstalled(),
      isStandalone,
      isIOS,
      isAndroid,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      detectionMethod: isStandalone ? 'display-mode' : (isIOS ? 'iOS' : (isAndroid ? 'Android' : 'web'))
    };
  },

  /**
   * Check for app updates from server
   * @param {string} currentVersion - Current app version
   * @param {string} itsId - User ID for tracking
   * @param {string} appType - 'user' or 'admin'
   * @returns {Promise<Object>} Update information
   */
  async checkForUpdates(currentVersion, itsId, appType = 'user') {
    try {
      const res = await fetch('/api/app/check-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userVersion: currentVersion,
          itsId: itsId,
          appType: appType
        })
      });

      if (!res.ok) {
        console.error('Update check failed:', res.status);
        return null;
      }

      const data = await res.json();

      // Log important updates
      if (data.hasUpdate) {
        console.log(`[PWA] Update available: ${currentVersion} → ${data.currentVersion}`);
      }

      return data;
    } catch (err) {
      console.error('Update check error:', err);
      return null;
    }
  },

  /**
   * Start periodic update checking
   * @param {string} currentVersion - Current app version
   * @param {string} itsId - User ID
   * @param {string} appType - 'user' or 'admin'
   * @param {number} intervalMs - Check interval in milliseconds (default 5 min)
   */
  startPeriodicUpdateCheck(currentVersion, itsId, appType = 'user', intervalMs = 300000) {
    if (!itsId) {
      console.warn('[PWA] Cannot start periodic updates: no itsId provided');
      return;
    }

    // Initial check
    this.checkForUpdates(currentVersion, itsId, appType);

    // Periodic checks
    const intervalId = setInterval(() => {
      this.checkForUpdates(currentVersion, itsId, appType);
    }, intervalMs);

    // Return interval ID in case caller needs to stop it
    return intervalId;
  },

  /**
   * Stop periodic update checking
   * @param {number} intervalId - Interval ID returned from startPeriodicUpdateCheck
   */
  stopPeriodicUpdateCheck(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
      console.log('[PWA] Stopped periodic update checking');
    }
  },

  /**
   * Get app installation status for analytics
   * Returns object suitable for sending to server
   */
  getAnalyticsData() {
    const status = this.getInstallationStatus();
    return {
      isInstalled: status.isInstalled,
      detectionMethod: status.detectionMethod,
      platform: status.platform,
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Send installation event to server for analytics
   * @param {string} itsId - User ID
   * @param {string} currentVersion - App version
   */
  async trackInstallation(itsId, currentVersion) {
    if (!itsId) {
      console.warn('[PWA] Cannot track installation: no itsId provided');
      return;
    }

    try {
      const status = this.getInstallationStatus();

      const response = await fetch('/api/app-analytics/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itsId: itsId,
          version: currentVersion,
          installationStatus: status,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        console.log('[PWA] Installation tracked');
      }
    } catch (err) {
      console.warn('[PWA] Failed to track installation:', err);
      // Silently fail - don't interrupt user experience
    }
  },

  /**
   * Check if update is available and show notification
   * (Typically called after checkForUpdates)
   * @param {Object} updateInfo - Result from checkForUpdates
   * @returns {boolean} True if update is available
   */
  hasUpdateAvailable(updateInfo) {
    return updateInfo && updateInfo.hasUpdate === true;
  },

  /**
   * Check if update is mandatory
   * @param {Object} updateInfo - Result from checkForUpdates
   * @returns {boolean} True if update must be installed
   */
  isUpdateRequired(updateInfo) {
    return updateInfo && updateInfo.updateRequired === true;
  },

  /**
   * Get update details for display to user
   * @param {Object} updateInfo - Result from checkForUpdates
   * @returns {Object} Formatted update details
   */
  formatUpdateInfo(updateInfo) {
    if (!updateInfo) return null;

    return {
      available: updateInfo.hasUpdate,
      required: updateInfo.updateRequired,
      currentVersion: updateInfo.currentVersion,
      userVersion: updateInfo.userVersion,
      message: updateInfo.updateMessage,
      features: updateInfo.updateFeatures || [],
      downloadUrl: updateInfo.downloadUrl || '/user/'
    };
  }
};

// Make PWAUtils available globally
if (typeof window !== 'undefined') {
  window.PWAUtils = PWAUtils;
}
