// User Portal Persistence for PWA - Store ITS ID and auto-load data

class UserPortalPersistence {
  static readonly STORAGE_KEY = 'user_its_id';
  static readonly LAST_SEARCH_KEY = 'user_last_search';

  static saveItsId(itsId) {
    try {
      localStorage.setItem(this.STORAGE_KEY, itsId);
      localStorage.setItem(this.LAST_SEARCH_KEY, JSON.stringify({
        itsId,
        timestamp: Date.now()
      }));
      console.log('[User] ITS ID saved:', itsId);
    } catch (err) {
      console.warn('[User] Could not save ITS ID:', err);
    }
  }

  static getStoredItsId() {
    try {
      const itsId = localStorage.getItem(this.STORAGE_KEY);
      return itsId ? itsId.trim() : null;
    } catch (err) {
      console.warn('[User] Error reading stored ITS ID:', err);
      return null;
    }
  }

  static clearItsId() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.LAST_SEARCH_KEY);
      console.log('[User] ITS ID cleared');
    } catch (err) {
      console.warn('[User] Error clearing ITS ID:', err);
    }
  }

  static async autoLoadUserData() {
    const storedItsId = this.getStoredItsId();

    if (!storedItsId) {
      console.log('[User] No stored ITS ID found');
      return false;
    }

    try {
      console.log('[User] Auto-loading data for ITS ID:', storedItsId);

      // Populate the form field
      const lookupInput = document.getElementById('itsIdInput');
      if (lookupInput) {
        lookupInput.value = storedItsId;
      }

      // Simulate form submission
      const lookupForm = document.getElementById('lookupForm');
      if (lookupForm) {
        // Trigger the submit event
        const event = new Event('submit', { bubbles: true });
        lookupForm.dispatchEvent(event);
        return true;
      }
    } catch (err) {
      console.error('[User] Auto-load error:', err);
      return false;
    }
  }

  static setupFormPersistence() {
    const lookupForm = document.getElementById('lookupForm');
    if (!lookupForm) return;

    // Intercept form submissions to save ITS ID
    lookupForm.addEventListener('submit', (e) => {
      const lookupInput = document.getElementById('itsIdInput');
      if (lookupInput && lookupInput.value) {
        this.saveItsId(lookupInput.value);
      }
    });
  }

  static setupSearchAgainButton() {
    // Handle "Search Again" button to allow changing ITS ID
    document.addEventListener('click', (e) => {
      if (e.target.textContent?.includes('Search Again')) {
        const lookupInput = document.getElementById('itsIdInput');
        if (lookupInput) {
          lookupInput.focus();
          lookupInput.select();
        }
      }
    });
  }

  static async backgroundRefreshData() {
    // Refresh data every 5 minutes if app is open
    const refreshInterval = 5 * 60 * 1000;

    setInterval(async () => {
      const storedItsId = this.getStoredItsId();
      if (!storedItsId) return;

      try {
        console.log('[User] Background refresh: fetching latest data for', storedItsId);
        // Trigger a silent data refresh
        // This can be handled by existing refresh mechanisms
        const event = new CustomEvent('userDataRefresh', { detail: { itsId: storedItsId } });
        window.dispatchEvent(event);
      } catch (err) {
        console.warn('[User] Background refresh error:', err);
      }
    }, refreshInterval);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[User] Initializing user portal persistence...');

  // Setup form persistence (save ITS ID on search)
  UserPortalPersistence.setupFormPersistence();
  UserPortalPersistence.setupSearchAgainButton();

  // Start background refresh
  UserPortalPersistence.backgroundRefreshData();

  // Wait a bit for DOM to fully load
  setTimeout(async () => {
    // Auto-load previous user data
    const autoLoadSuccess = await UserPortalPersistence.autoLoadUserData();

    if (autoLoadSuccess) {
      console.log('[User] Auto-loaded user data from stored ITS ID');
    }
  }, 500);
});
