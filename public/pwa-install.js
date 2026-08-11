// PWA Installation and Update Management
class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.installButton = null;
    this.updateBanner = null;
    this.init();
  }

  init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service Worker registered');

          // Check for updates periodically
          setInterval(() => registration.update(), 60000); // Check every minute

          // Listen for controller change (new SW activated)
          navigator.serviceWorker.controller?.addEventListener('controllerchange', () => {
            this.showUpdateBanner();
          });

          // Check if there's a waiting service worker
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
    }

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallPrompt();
    });

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.deferredPrompt = null;
      this.hideInstallPrompt();
    });

    // Detect if app is running standalone (installed)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      console.log('[PWA] App is running in standalone mode');
      document.body.classList.add('pwa-standalone');
    }
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
