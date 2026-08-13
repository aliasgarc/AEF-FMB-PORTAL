// Device Detection and Installation Instructions
class DeviceDetector {
  constructor() {
    this.device = this.detectDevice();
    this.init();
  }

  detectDevice() {
    const ua = navigator.userAgent.toLowerCase();

    // iOS Detection
    if (/iphone|ipad|ipod/.test(ua)) {
      return {
        type: 'ios',
        name: /ipad/.test(ua) ? 'iPad' : 'iPhone',
        browser: 'Safari'
      };
    }

    // Android Detection
    if (/android/.test(ua)) {
      let browser = 'Browser';
      if (/chrome/.test(ua) && !/chromium/.test(ua)) {
        browser = 'Chrome';
      } else if (/firefox/.test(ua)) {
        browser = 'Firefox';
      } else if (/edg/.test(ua)) {
        browser = 'Edge';
      }

      return {
        type: 'android',
        name: 'Android',
        browser: browser
      };
    }

    // Desktop Detection
    return {
      type: 'desktop',
      name: 'Desktop',
      browser: this.detectBrowser(ua)
    };
  }

  detectBrowser(ua) {
    if (/edg/.test(ua)) return 'Edge';
    if (/chrome/.test(ua)) return 'Chrome';
    if (/firefox/.test(ua)) return 'Firefox';
    if (/safari/.test(ua) && !/chrome/.test(ua)) return 'Safari';
    return 'Browser';
  }

  init() {
    // Auto-show instructions if install guide exists
    if (document.getElementById('device-instructions-container')) {
      this.showDeviceInstructions();
    }
  }

  showDeviceInstructions() {
    const container = document.getElementById('device-instructions-container');
    if (!container) return;

    const instructions = this.getInstructions();
    container.innerHTML = instructions;
  }

  getInstructions() {
    switch (this.device.type) {
      case 'ios':
        return this.getIOSInstructions();
      case 'android':
        return this.getAndroidInstructions();
      default:
        return this.getDesktopInstructions();
    }
  }

  getIOSInstructions() {
    return `
      <div class="device-instructions ios-instructions">
        <div class="device-header">
          <div class="device-icon">🍎</div>
          <div class="device-info">
            <h2>iPhone / iPad Installation</h2>
            <p>Using Safari - Easy 4 Steps</p>
          </div>
        </div>

        <div class="instructions-steps">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>Open Safari</h3>
              <p>Use Safari browser (required for PWA installation on iOS)</p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>Visit the App</h3>
              <p>Go to: <code>https://saas-payment-tracker.vercel.app/user</code></p>
              <p class="note">Or admin at: <code>/admin</code></p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>Tap Share Button</h3>
              <p>Tap the <strong>Share</strong> button (↑) at the bottom</p>
              <p class="note">Scroll down in the menu if needed</p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">4</div>
            <div class="step-content">
              <h3>Add to Home Screen</h3>
              <p>Tap <strong>"Add to Home Screen"</strong></p>
              <p>Confirm the app name and tap <strong>"Add"</strong></p>
              <p class="success">✅ Icon now on home screen!</p>
            </div>
          </div>
        </div>

        <div class="what-you-get">
          <h3>What You Get</h3>
          <ul>
            <li>✅ App icon on home screen</li>
            <li>✅ Full-screen app mode (no Safari UI)</li>
            <li>✅ Works offline with cached data</li>
            <li>✅ Automatic updates</li>
            <li>✅ Forest green theme</li>
          </ul>
        </div>

        <div class="browser-requirement">
          <strong>⚠️ Important:</strong> Must use <strong>Safari</strong> on iOS.
          Chrome/Firefox won't show the install option.
        </div>
      </div>
    `;
  }

  getAndroidInstructions() {
    return `
      <div class="device-instructions android-instructions">
        <div class="device-header">
          <div class="device-icon">🤖</div>
          <div class="device-info">
            <h2>Android Installation</h2>
            <p>Using ${this.device.browser} - Install Prompt Shows Automatically</p>
          </div>
        </div>

        <div class="instructions-steps">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>Open ${this.device.browser}</h3>
              <p>Use Chrome, Edge, or Brave browser (best PWA support)</p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>Visit the App</h3>
              <p>Go to: <code>https://saas-payment-tracker.vercel.app/user</code></p>
              <p class="note">Or admin at: <code>/admin</code></p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>Wait for Banner</h3>
              <p>Within 2-3 seconds, you'll see a banner at the top:</p>
              <div class="banner-preview">
                📱 Install App
                <br/>Get quick access to Payment Tracker
              </div>
            </div>
          </div>

          <div class="step">
            <div class="step-number">4</div>
            <div class="step-content">
              <h3>Tap Install</h3>
              <p>Tap the <strong>"Install"</strong> button</p>
              <p>Confirm in the system dialog</p>
              <p class="success">✅ Icon now in app drawer!</p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">Or</div>
            <div class="step-content manual">
              <h3>Manual Installation (if no banner)</h3>
              <p>Tap menu (⋮) → "Add to Home Screen"</p>
              <p>Select app name and tap "Add"</p>
            </div>
          </div>
        </div>

        <div class="what-you-get">
          <h3>What You Get</h3>
          <ul>
            <li>✅ App icon in app drawer</li>
            <li>✅ Full-screen app (no browser bar)</li>
            <li>✅ Works offline with cached data</li>
            <li>✅ Automatic updates (60-second check)</li>
            <li>✅ Lightning fast loading</li>
          </ul>
        </div>

        <div class="browser-requirement">
          <strong>💡 Tip:</strong> Chrome and Edge show the banner automatically.
          Other browsers may require manual "Add to Home Screen".
        </div>
      </div>
    `;
  }

  getDesktopInstructions() {
    return `
      <div class="device-instructions desktop-instructions">
        <div class="device-header">
          <div class="device-icon">💻</div>
          <div class="device-info">
            <h2>Desktop/Laptop Installation</h2>
            <p>Using ${this.device.browser} - Install Icon Appears</p>
          </div>
        </div>

        <div class="instructions-steps">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>Open ${this.device.browser}</h3>
              <p>Chrome, Edge, or Brave recommended for best PWA support</p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>Visit the App</h3>
              <p>Go to: <code>https://saas-payment-tracker.vercel.app/user</code></p>
              <p class="note">Or admin at: <code>/admin</code></p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>Look for Install Icon</h3>
              <p>An <strong>install icon</strong> appears in the address bar</p>
              <div class="icon-preview">
                [Address bar] [Install Icon ↓] [Extensions]
              </div>
              <p class="note">Or wait for install prompt to appear</p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">4</div>
            <div class="step-content">
              <h3>Click Install</h3>
              <p>Click the <strong>install icon</strong> or tap "Install" in the prompt</p>
              <p>Confirm the dialog</p>
              <p class="success">✅ App launches in standalone window!</p>
            </div>
          </step>
        </div>

        <div class="what-you-get">
          <h3>What You Get</h3>
          <ul>
            <li>✅ Standalone app window</li>
            <li>✅ No browser address bar</li>
            <li>✅ Works offline with cached data</li>
            <li>✅ Automatic updates</li>
            <li>✅ Added to applications menu</li>
            <li>✅ Faster loading than browser</li>
          </ul>
        </div>

        <div class="browser-requirement">
          <strong>💡 Tip:</strong> Chrome and Edge show install option automatically.
          Firefox supports offline but no install prompt. Safari not recommended for PWA.
        </div>
      </div>
    `;
  }

  // Public methods to get device info
  getDeviceType() {
    return this.device.type;
  }

  getDeviceName() {
    return this.device.name;
  }

  getBrowserName() {
    return this.device.browser;
  }

  // Show installation banner based on device
  showInstallationBanner() {
    const banner = document.createElement('div');
    banner.className = 'installation-banner device-specific';
    banner.id = 'installation-banner';

    let content = '';
    if (this.device.type === 'ios') {
      content = `
        <div class="banner-content">
          <strong>📱 iOS Installation Guide</strong>
          <p>Tap Share → "Add to Home Screen"</p>
        </div>
        <button class="banner-close" onclick="this.parentElement.remove()">✕</button>
      `;
    } else if (this.device.type === 'android') {
      content = `
        <div class="banner-content">
          <strong>🤖 Android Installation</strong>
          <p>Look for "Install App" banner or tap menu → "Add to Home Screen"</p>
        </div>
        <button class="banner-close" onclick="this.parentElement.remove()">✕</button>
      `;
    } else {
      content = `
        <div class="banner-content">
          <strong>💻 Desktop Installation</strong>
          <p>Look for install icon in address bar or wait for prompt</p>
        </div>
        <button class="banner-close" onclick="this.parentElement.remove()">✕</button>
      `;
    }

    banner.innerHTML = content;
    document.body.insertBefore(banner, document.body.firstChild);
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.deviceDetector = new DeviceDetector();
  });
} else {
  window.deviceDetector = new DeviceDetector();
}

console.log('[Device Detection] Initialized - Device: ' + (window.deviceDetector ? window.deviceDetector.getDeviceName() : 'Unknown'));
