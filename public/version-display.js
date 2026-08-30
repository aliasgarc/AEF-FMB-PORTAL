// Version Badge Display with Modal
function initVersionDisplay() {
  const appVersion = document.querySelector('meta[name="app-version"]')?.content || 'unknown';

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

  // Setup modal functionality
  setupVersionModal(appVersion);

  console.log('[Version] App version:', appVersion);
}

function setupVersionModal(appVersion) {
  const versionBadges = document.querySelectorAll('.version-badge');

  versionBadges.forEach(badge => {
    badge.style.cursor = 'pointer';
    badge.addEventListener('click', () => showVersionModal(appVersion));
  });
}

function showVersionModal(appVersion) {
  // Remove existing modal if any
  const existingModal = document.getElementById('versionModal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'versionModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 32px;
    max-width: 400px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease-out;
  `;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  modalContent.innerHTML = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 32px; margin-bottom: 12px;">📦</div>
      <h2 style="color: #3c7441; margin: 0 0 8px 0; font-size: 20px;">App Version Info</h2>
      <p style="color: #64748b; margin: 0; font-size: 14px;">Current version details</p>
    </div>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
        <div>
          <div style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Version</div>
          <div style="color: #0f172a; font-size: 18px; font-weight: 700;">v${appVersion}</div>
        </div>
        <button id="copyVersionBtn" style="
          background: #3c7441;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
        " onmouseover="this.style.background='#2a5230'" onmouseout="this.style.background='#3c7441'">
          📋 Copy
        </button>
      </div>
    </div>

    <div style="background: #f0fdf4; border-left: 3px solid #22c55e; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
      <div style="color: #15803d; font-size: 12px; font-weight: 600; margin-bottom: 4px;">Last Updated</div>
      <div style="color: #166534; font-size: 13px;">${dateStr}</div>
    </div>

    <div style="background: #fef3c7; border-left: 3px solid #f59e0b; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
      <div style="color: #92400e; font-size: 12px; font-weight: 600; margin-bottom: 4px;">💡 For Support</div>
      <div style="color: #b45309; font-size: 13px;">Share this version when reporting issues to our support team.</div>
    </div>

    <button id="closeVersionBtn" style="
      width: 100%;
      background: #e2e8f0;
      color: #0f172a;
      border: none;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    " onmouseover="this.style.background='#cbd5e1'" onmouseout="this.style.background='#e2e8f0'">
      Close
    </button>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Close button
  document.getElementById('closeVersionBtn').addEventListener('click', () => {
    modal.remove();
  });

  // Copy button
  document.getElementById('copyVersionBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(`v${appVersion}`).then(() => {
      const btn = document.getElementById('copyVersionBtn');
      const originalText = btn.textContent;
      btn.textContent = '✅ Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    }).catch(() => {
      alert('Failed to copy version');
    });
  });

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVersionDisplay);
} else {
  initVersionDisplay();
}
