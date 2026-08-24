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
    // Register service worker with version to enable cache busting on updates
    if ('serviceWorker' in navigator) {
      // Get version from manifest or use timestamp as fallback for cache busting
      const version = document.querySelector('meta[name="app-version"]')?.content ||
                     new Date().toISOString().split('T')[0];
      const swUrl = `/service-worker.js?v=${encodeURIComponent(version)}`;
      navigator.serviceWorker.register(swUrl, { scope: '/' })
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

    // If no prompt after 4 seconds, show device-specific fallback
    setTimeout(() => {
      if (!this.promptShown && !this.isInstalledApp()) {
        if (this.isIOS) {
          console.log('[PWA] iOS detected, showing install instructions');
          this.showIOSInstallBanner();
        } else if (this.isAndroid) {
          console.log('[PWA] No native prompt, showing improved Android banner');
          this.showImprovedAndroidInstall();
        }
      }
    }, 4000);

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

    // Device-specific install prompt
    if (this.isIOS) {
      banner.innerHTML = `
        <div class="pwa-install-content">
          <div>
            <strong>🍎 Add to Home Screen</strong>
            <p>Quick access to AEF-FMB-Portal</p>
          </div>
          <div class="pwa-install-buttons">
            <button id="pwa-install-btn" class="btn">Show Instructions</button>
            <button id="pwa-close-btn" class="btn secondary">Later</button>
          </div>
        </div>
      `;
    } else {
      // Android/Desktop
      banner.innerHTML = `
        <div class="pwa-install-content">
          <div>
            <strong>📱 Install App</strong>
            <p>Get quick access to Payment Tracker on your device</p>
          </div>
          <div class="pwa-install-buttons">
            <button id="pwa-install-btn" class="btn">Install Now</button>
            <button id="pwa-close-btn" class="btn secondary">Later</button>
          </div>
        </div>
      `;
    }

    document.body.insertBefore(banner, document.body.firstChild);

    // Install button handler - device specific
    document.getElementById('pwa-install-btn').addEventListener('click', () => {
      if (this.isIOS) {
        // Show iOS instructions
        this.showIOSInstallInstructions();
      } else if (this.deferredPrompt) {
        // Try native Android install
        this.deferredPrompt.prompt();
        this.deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('[PWA] User accepted install');
          } else {
            console.log('[PWA] User dismissed install');
          }
          this.deferredPrompt = null;
        });
      } else {
        // Fallback for Android without native prompt
        this.showImprovedAndroidInstall();
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

  showIOSInstallInstructions() {
    const modal = document.createElement('div');
    modal.id = 'pwa-ios-install-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
    `;

    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 28px; max-width: 520px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
        <h2 style="color: #3c7441; margin: 0 0 24px 0; font-size: 22px;">🍎 Add to Home Screen</h2>

        <div style="background: #f8fafc; border-left: 4px solid #3c7441; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <strong style="color: #3c7441; display: block; margin-bottom: 8px;">Using Safari</strong>
          <p style="margin: 0; color: #666; font-size: 14px;">This works on iPhone, iPad, and iPod Touch</p>
        </div>

        <div style="color: #666; line-height: 1.8; margin-bottom: 24px;">
          <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
            <span style="background: #3c7441; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px; font-weight: 700;">1</span>
            <div><strong style="color: #1a1a1a;">Tap the Share button</strong><br/><span style="font-size: 13px;">Look for the upward arrow (↑) at the bottom of screen</span></div>
          </div>
          <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
            <span style="background: #3c7441; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px; font-weight: 700;">2</span>
            <div><strong style="color: #1a1a1a;">Find "Add to Home Screen"</strong><br/><span style="font-size: 13px;">Scroll down in the popup menu</span></div>
          </div>
          <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
            <span style="background: #3c7441; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px; font-weight: 700;">3</span>
            <div><strong style="color: #1a1a1a;">Tap "Add"</strong><br/><span style="font-size: 13px;">Choose the app name and tap Add button</span></div>
          </div>
          <div style="display: flex; align-items: flex-start;">
            <span style="background: #3c7441; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px; font-weight: 700;">4</span>
            <div><strong style="color: #1a1a1a;">Done! App is on home screen</strong><br/><span style="font-size: 13px;">Open it anytime like a regular app</span></div>
          </div>
        </div>

        <div style="background: #e3f2fd; border: 1px solid #64b5f6; padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <strong style="color: #1565c0; font-size: 14px;">💡 Must use Safari, not Chrome or Firefox</strong>
        </div>

        <button onclick="document.getElementById('pwa-ios-install-modal').remove()"
                style="width: 100%; background: linear-gradient(135deg, #3c7441 0%, #5a9b62 100%); color: white; border: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px;">
          Ready to Install! Open Safari
        </button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  showIOSInstallBanner() {
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
          <strong>🍎 Add to Home Screen</strong>
          <p>Quick access on your iPhone or iPad</p>
        </div>
        <div class="pwa-install-buttons">
          <button id="pwa-ios-help-btn" class="btn">Show Me How</button>
          <button id="pwa-close-btn" class="btn secondary">Later</button>
        </div>
      </div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);

    // Show instructions button
    document.getElementById('pwa-ios-help-btn').addEventListener('click', () => {
      this.showIOSInstallInstructions();
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

  showImprovedAndroidInstall() {
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
          <p>One-tap installation to your device</p>
        </div>
        <div class="pwa-install-buttons">
          <button id="pwa-android-install-btn" class="btn" style="background: linear-gradient(135deg, #3c7441 0%, #5a9b62 100%); font-size: 16px; font-weight: 700;">Install Now</button>
          <button id="pwa-close-btn" class="btn secondary">Later</button>
        </div>
      </div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);

    // Install button handler - show step-by-step instructions
    document.getElementById('pwa-android-install-btn').addEventListener('click', () => {
      this.showAndroidInstallSteps();
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

  showAndroidInstallSteps() {
    const modal = document.createElement('div');
    modal.id = 'pwa-install-steps-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
    `;

    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 28px; max-width: 520px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
        <h2 style="color: #3c7441; margin: 0 0 24px 0; font-size: 22px;">📱 Install Payment Tracker</h2>

        <div style="background: #f8fafc; border-left: 4px solid #3c7441; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <strong style="color: #3c7441; display: block; margin-bottom: 8px;">Quick Install</strong>
          <p style="margin: 0; color: #666; font-size: 14px;">Tap the browser menu (⋮) → "<strong>Add to Home Screen</strong>"</p>
        </div>

        <div style="color: #666; line-height: 1.8; margin-bottom: 24px;">
          <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
            <span style="background: #3c7441; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px; font-weight: 700;">1</span>
            <div><strong style="color: #1a1a1a;">Tap the menu</strong><br/><span style="font-size: 13px;">Look for three dots (⋮) in top right corner</span></div>
          </div>
          <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
            <span style="background: #3c7441; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px; font-weight: 700;">2</span>
            <div><strong style="color: #1a1a1a;">Find "Add to Home Screen"</strong><br/><span style="font-size: 13px;">Scroll down if you don't see it</span></div>
          </div>
          <div style="display: flex; align-items: flex-start;">
            <span style="background: #3c7441; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px; font-weight: 700;">3</span>
            <div><strong style="color: #1a1a1a;">Confirm & done!</strong><br/><span style="font-size: 13px;">Icon appears on your home screen</span></div>
          </div>
        </div>

        <div style="background: #e8f5e9; border: 1px solid #81c784; padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <strong style="color: #2e7d32; font-size: 14px;">✅ No downloads or signup needed!</strong>
        </div>

        <button onclick="document.getElementById('pwa-install-steps-modal').remove()"
                style="width: 100%; background: linear-gradient(135deg, #3c7441 0%, #5a9b62 100%); color: white; border: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px;">
          Got It! Open Menu (⋮)
        </button>
      </div>
    `;

    document.body.appendChild(modal);
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
