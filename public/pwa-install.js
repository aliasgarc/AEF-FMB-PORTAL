// PWA Installation and Update Management
class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.installButton = null;
    this.updateBanner = null;
    this.promptShown = false;
    this.isAndroid = /Android/i.test(navigator.userAgent);
    this.isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.init();
  }

  init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service Worker registered successfully');

          // Check for updates periodically
          setInterval(() => registration.update(), 60000);

          // Listen for controller change
          navigator.serviceWorker.controller?.addEventListener('controllerchange', () => {
            this.showUpdateBanner();
          });

          if (registration.waiting) {
            this.showUpdateBanner(registration.waiting);
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.showUpdateBanner(newWorker);
              }
            });
          });
        })
        .catch((err) => console.error('[PWA] Service Worker registration failed:', err));
    } else {
      console.warn('[PWA] Service Workers not supported');
    }

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PWA] Install prompt received');
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallPrompt();
      this.promptShown = true;
    });

    // If no prompt after 3 seconds, show fallback for Android
    setTimeout(() => {
      if (!this.promptShown && this.isAndroid && !this.isInstalledApp()) {
        console.log('[PWA] No native prompt, showing Android fallback banner');
        this.showAndroidFallbackBanner();
      }
    }, 3000);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.deferredPrompt = null;
      this.hideInstallPrompt();
    });

    // Detect if app is running standalone
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      console.log('[PWA] App is running in standalone mode');
      document.body.classList.add('pwa-standalone');
    }
  }

  isInstalledApp() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
  }

  showInstallPrompt() {
    const existingPrompt = document.getElementById('pwa-install-prompt');
    if (existingPrompt) {
      existingPrompt.style.display = 'flex';
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'pwa-install-prompt';
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-install-content">
        <div>
          <strong>📱 Install App</strong>
          <p>Get quick access to Payment Tracker on your device</p>
        </div>
        <div class="pwa-install-buttons">
          <button id="pwa-install-btn" class="btn">Install</button>
          <button id="pwa-close-btn" class="btn secondary">Later</button>
        </div>
      </div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);

    // Install button handler
    document.getElementById('pwa-install-btn').addEventListener('click', () => {
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        this.deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('[PWA] User accepted install');
          } else {
            console.log('[PWA] User dismissed install');
          }
          this.deferredPrompt = null;
        });
      }
    });

    // Close button handler
    document.getElementById('pwa-close-btn').addEventListener('click', () => {
      this.hideInstallPrompt();
      // Don't show again for 7 days
      localStorage.setItem('pwa-install-dismissed', new Date().getTime().toString());
    });

    // Hide if dismissed recently
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const daysSinceDismissed = (new Date().getTime() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        banner.style.display = 'none';
      }
    }
  }

  hideInstallPrompt() {
    const banner = document.getElementById('pwa-install-prompt');
    if (banner) {
      banner.style.display = 'none';
    }
  }

  showAndroidFallbackBanner() {
    const existingPrompt = document.getElementById('pwa-install-prompt');
    if (existingPrompt) {
      existingPrompt.style.display = 'flex';
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'pwa-install-prompt';
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-install-content">
        <div>
          <strong>📱 Install App</strong>
          <p>Tap menu → Add to Home Screen</p>
        </div>
        <div class="pwa-install-buttons">
          <button id="pwa-android-help-btn" class="btn">Show Me How</button>
          <button id="pwa-close-btn" class="btn secondary">Later</button>
        </div>
      </div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);

    // Show instructions button
    document.getElementById('pwa-android-help-btn').addEventListener('click', () => {
      this.showAndroidInstructions();
    });

    // Close button handler
    document.getElementById('pwa-close-btn').addEventListener('click', () => {
      this.hideInstallPrompt();
      localStorage.setItem('pwa-install-dismissed', new Date().getTime().toString());
    });

    // Hide if dismissed recently
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const daysSinceDismissed = (new Date().getTime() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        banner.style.display = 'none';
      }
    }
  }

  showAndroidInstructions() {
    const modal = document.createElement('div');
    modal.id = 'pwa-instructions-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
    `;

    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 24px; max-width: 500px; text-align: center;">
        <h2 style="color: #3c7441; margin: 0 0 16px 0;">How to Install on Android</h2>
        <div style="text-align: left; color: #666; line-height: 1.8; margin-bottom: 20px;">
          <p><strong>Step 1:</strong> Tap the menu button (⋮) at the top right</p>
          <p><strong>Step 2:</strong> Select "<strong>Add to Home Screen</strong>"</p>
          <p><strong>Step 3:</strong> Choose a name (or keep default)</p>
          <p><strong>Step 4:</strong> Tap "<strong>Add</strong>" to confirm</p>
          <p style="margin-top: 20px; background: #f0f0f0; padding: 12px; border-radius: 6px;">
            ✅ Icon will appear on your home screen!<br/>
            You can now open it like any other app.
          </p>
        </div>
        <button onclick="document.getElementById('pwa-instructions-modal').remove()"
                style="background: linear-gradient(135deg, #3c7441 0%, #5a9b62 100%); color: white; border: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; cursor: pointer;">
          Got It!
        </button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  showUpdateBanner(newWorker) {
    const existingBanner = document.getElementById('pwa-update-banner');
    if (existingBanner) {
      existingBanner.style.display = 'flex';
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.className = 'pwa-update-banner';
    banner.innerHTML = `
      <div class="pwa-update-content">
        <div>
          <strong>🔄 Update Available</strong>
          <p>A new version of the app is ready</p>
        </div>
        <div class="pwa-update-buttons">
          <button id="pwa-update-btn" class="btn">Update</button>
          <button id="pwa-update-close-btn" class="btn secondary">Later</button>
        </div>
      </div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);

    // Update button handler
    document.getElementById('pwa-update-btn').addEventListener('click', () => {
      if (newWorker) {
        newWorker.postMessage({ type: 'SKIP_WAITING' });
      } else if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    });

    // Close button handler
    document.getElementById('pwa-update-close-btn').addEventListener('click', () => {
      const b = document.getElementById('pwa-update-banner');
      if (b) b.style.display = 'none';
    });
  }
}

// Initialize PWA manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PWAManager();
  });
} else {
  new PWAManager();
}

console.log('[PWA] Manager initialized');
