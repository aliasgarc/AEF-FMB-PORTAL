// Version Badge Display
function initVersionDisplay() {
  const appVersion = document.querySelector('meta[name="app-version"]')?.content || 'unknown';
  const versionBadges = document.querySelectorAll('[id$="VersionBadge"] #' + (document.getElementById('versionText') ? 'versionText' : 'userVersionText'));

  // Update admin dashboard version
  const adminVersionText = document.getElementById('versionText');
  if (adminVersionText) {
    adminVersionText.textContent = `v${appVersion}`;
  }

  // Update user portal version
  const userVersionText = document.getElementById('userVersionText');
  if (userVersionText) {
    userVersionText.textContent = `v${appVersion}`;
  }

  console.log('[Version] App version:', appVersion);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVersionDisplay);
} else {
  initVersionDisplay();
}
