// Admin Login Persistence for PWA

class AdminLoginPersistence {
  static STORAGE_KEY = 'admin_login_session';
  static REMEMBER_KEY = 'admin_remember_me';

  static saveCredentials(username, password) {
    try {
      const session = {
        username,
        password,
        timestamp: Date.now(),
        autoLogin: true
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
      console.log('[Auth] Admin credentials saved');
    } catch (err) {
      console.warn('[Auth] Could not save credentials:', err);
    }
  }

  static getStoredCredentials() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const session = JSON.parse(stored);
      // Check if session is older than 30 days
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - session.timestamp > thirtyDaysMs) {
        this.clearCredentials();
        return null;
      }

      return session;
    } catch (err) {
      console.warn('[Auth] Error reading stored credentials:', err);
      return null;
    }
  }

  static clearCredentials() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.REMEMBER_KEY);
      console.log('[Auth] Credentials cleared');
    } catch (err) {
      console.warn('[Auth] Error clearing credentials:', err);
    }
  }

  static async autoLogin() {
    const credentials = this.getStoredCredentials();
    if (!credentials) return false;

    try {
      console.log('[Auth] Attempting auto-login...');
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Auth] Auto-login successful');
        // Store the session token if provided
        if (data.token) {
          localStorage.setItem('admin_token', data.token);
        }
        return true;
      } else {
        console.log('[Auth] Auto-login failed, credentials may be invalid');
        this.clearCredentials();
        return false;
      }
    } catch (err) {
      console.error('[Auth] Auto-login error:', err);
      return false;
    }
  }

  static setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    const rememberCheckbox = document.getElementById('rememberMe');

    if (!loginForm) return;

    // Handle form submission
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = usernameField.value;
      const password = passwordField.value;
      const rememberMe = rememberCheckbox?.checked || false;

      // Save credentials if "Remember Me" is checked
      if (rememberMe) {
        this.saveCredentials(username, password);
      } else {
        this.clearCredentials();
      }

      // Form will be submitted naturally, just store the data
      loginForm.submit();
    });

    // On page load, check if we should show "Remember Me" checkbox
    if (this.getStoredCredentials()) {
      if (rememberCheckbox) {
        rememberCheckbox.checked = true;
      }
    }
  }

  static setupLogout() {
    // Listen for logout clicks
    document.addEventListener('click', (e) => {
      if (e.target.textContent?.includes('Sign Out') || e.target.textContent?.includes('Logout')) {
        this.clearCredentials();
      }
    });
  }
}

// Auto-login on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Auth] Initializing login persistence...');

  // Check if already logged in
  const isLoggedIn = document.getElementById('whoami')?.textContent?.trim();

  if (!isLoggedIn) {
    // Try auto-login
    const autoLoginSuccess = await AdminLoginPersistence.autoLogin();

    if (autoLoginSuccess) {
      // Redirect to dashboard after short delay
      setTimeout(() => {
        window.location.href = '/admin/dashboard.html';
      }, 1000);
    }
  }

  // Setup login form
  AdminLoginPersistence.setupLoginForm();
  AdminLoginPersistence.setupLogout();
});
