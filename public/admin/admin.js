// ---------- Login page ----------
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  // Password toggle
  const passwordToggle = document.getElementById('passwordToggle');
  const passwordInput = document.getElementById('password');
  if (passwordToggle) {
    passwordToggle.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      passwordToggle.textContent = type === 'password' ? '👁️' : '🙈';
    });
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');
    const submitBtn = document.getElementById('submitBtn');

    errorMsg.style.display = 'none';

    if (!username || !password) {
      errorMsg.textContent = '❌ Please enter both username and password';
      errorMsg.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading-spinner"></span>Signing in...';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        errorMsg.textContent = '❌ ' + (data.error || 'Login failed.');
        errorMsg.style.display = 'block';
        return;
      }
      window.location.href = '/admin/dashboard.html';
    } catch (err) {
      errorMsg.textContent = '❌ Network error. Please try again.';
      errorMsg.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

// ---------- Dashboard page ----------
// App version for update checking
const APP_VERSION = '1.2.0';

const usersBody = document.getElementById('usersBody');
if (usersBody) {
  init();
}

// Sorting state
let currentSortColumn = 'outstanding';
let sortDirection = 'desc';
let allUsers = [];

async function init() {
  try {
    const meRes = await fetchWithTimeout('/api/admin/me');
    if (!meRes.ok) {
      window.location.href = '/admin/login.html';
      return;
    }
    const me = await meRes.json();
    const whoamiEl = document.getElementById('whoami');
    if (whoamiEl) {
      whoamiEl.textContent = me.admin.username;
    }
  } catch (err) {
    console.error('Init error:', err);
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-box';
    errorMsg.textContent = 'Failed to load admin session: ' + err.message;
    document.body.insertBefore(errorMsg, document.body.firstChild);
    setTimeout(() => window.location.href = '/admin/login.html', 3000);
    return;
  }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login.html';
  });

  const combinedForm = document.getElementById('uploadCombinedForm');
  if (combinedForm) {
    combinedForm.addEventListener('submit', handleCombinedUpload);
  } else {
  }

  document.getElementById('closeDetail').addEventListener('click', () => {
    document.getElementById('detailPanel').style.display = 'none';
  });

  // Load users and analytics in parallel instead of sequentially
  await Promise.all([loadUsers(), loadAnalytics()]);

  // Start periodic update checking (every 5 minutes)
  if (window.PWAUtils && me && me.admin && me.admin.id) {
    PWAUtils.startPeriodicUpdateCheck(APP_VERSION, me.admin.id, 'admin', 300000);
    // Track installation for analytics
    PWAUtils.trackInstallation(me.admin.id, APP_VERSION);
  }
}

async function loadUsers() {
  try {
    // Fetch both user list and stats with timeout
    const usersRes = await fetchWithTimeout('/api/admin/users');
    const statsRes = await fetchWithTimeout('/api/admin/stats');

    if (!usersRes.ok) {
      throw new Error('Failed to fetch users: ' + (await usersRes.text()));
    }
    if (!statsRes.ok) {
      throw new Error('Failed to fetch statistics');
    }

    const usersData = await usersRes.json();
    const statsData = await statsRes.json();

    let users = usersData.users;
    const stats = statsData;

    // Store all users for sorting
    allUsers = users;

    // Sort users based on current sort settings
    users = sortUsers(users, currentSortColumn, sortDirection);

    // Calculate totals from Takhmeen contribution data
    const totalOutstanding = users.reduce((s, u) => s + Number(u.outstanding), 0);
    const totalBilled = stats.users.totalBilled;
    const totalPaid = stats.users.totalPaid;

    // Get payment receipt data
    const totalReceived = stats.receipts.totalReceived;
    const totalPending = stats.receipts.totalPending;

    const statsRowEl = document.getElementById('statsRow');
    if (!statsRowEl) {
      console.error('Stats row element not found');
      return;
    }

    const safeUsers = stats?.users || {};
    const safeTotalBilled = Number(safeUsers.totalBilled) || 0;
    const safeTotalReceived = Number(safeUsers.totalPaid) || 0;
    const usersWithTakhmeen = Number(safeUsers.usersWithTakhmeen) || 0;
    const totalUsers = Number(safeUsers.totalUsers) || 0;
    const takhmeenPercentage = totalUsers > 0 ? Math.round((usersWithTakhmeen / totalUsers) * 100) : 0;

    statsRowEl.innerHTML = `
      <div class="stat">
        <div class="stat-icon">👥</div>
        <div class="label">Total Users</div>
        <div class="value">${totalUsers}</div>
        <div class="change" style="font-size: 14px; font-weight: 600; color: #3c7441;">📊 ${usersWithTakhmeen} with Takhmeen <span style="background: linear-gradient(135deg, #3c7441, #60a472); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 700;">(${takhmeenPercentage}%)</span></div>
      </div>
      <div class="stat">
        <div class="stat-icon">💰</div>
        <div class="label">Total Takhmeen</div>
        <div class="value success">₹${currency(safeTotalBilled)}</div>
        <div class="change">Contribution amount</div>
      </div>
      <div class="stat">
        <div class="stat-icon">✅</div>
        <div class="label">Amount Received</div>
        <div class="value success">₹${currency(safeTotalReceived)}</div>
        <div class="change" style="color: var(--green);">+${safeTotalBilled > 0 ? Math.round((safeTotalReceived/safeTotalBilled)*100) : 0}% collected</div>
      </div>
      <div class="stat">
        <div class="stat-icon">⚠️</div>
        <div class="label">Pending Amount</div>
        <div class="value outstanding">₹${currency(totalPending)}</div>
        <div class="change negative">Still to receive</div>
      </div>
    `;

    document.getElementById('emptyState').style.display = users.length === 0 ? 'block' : 'none';
    document.getElementById('userCount').innerHTML = `<strong>${users.length}</strong> total users • Last updated: just now`;

    // Render users and setup sorting
    renderUsers(users);
    setupSortHandlers();
  } catch (err) {
    console.error('Load users error:', err);
    const errorEl = document.createElement('div');
    errorEl.className = 'error-box';
    errorEl.innerHTML = `<strong>Failed to load data:</strong> ${escapeHtml(err.message)}<br>
      <button onclick="location.reload()" class="btn small" style="margin-top: 12px;">🔄 Retry</button>`;
    document.querySelector('.container')?.insertBefore(errorEl, document.querySelector('.container')?.firstChild);
  }
}

function sortUsers(users, column, direction) {
  return users.sort((a, b) => {
    let aVal = a[column] || '';
    let bVal = b[column] || '';

    // Handle numeric values
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }

    // Handle string values
    aVal = String(aVal).toLowerCase();
    bVal = String(bVal).toLowerCase();

    if (direction === 'asc') {
      return aVal.localeCompare(bVal);
    } else {
      return bVal.localeCompare(aVal);
    }
  });
}

function setupSortHandlers() {
  const headers = document.querySelectorAll('th.sortable');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.sort;

      // Toggle direction if same column clicked
      if (currentSortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        currentSortColumn = column;
        sortDirection = 'desc';
      }

      // Update visual indicators
      headers.forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      if (sortDirection === 'asc') {
        header.classList.add('sort-asc');
      } else {
        header.classList.add('sort-desc');
      }

      // Re-render table with sorted data
      renderUsers(sortUsers(allUsers, currentSortColumn, sortDirection));
    });
  });
}

function renderUsers(users) {
  const tbody = document.getElementById('usersBody');
  // Build all HTML at once for better mobile performance
  let html = '';

  users.forEach((u) => {
    const itsId = escapeHtml(u.its_id || u.sabil_no || '-');
    const name = escapeHtml(u.name || '-');
    const mobile = escapeHtml(u.mobile || '-');
    const sector = escapeHtml(u.sector || '-');
    const billed = currency(u.total_billed || 0);
    const previousDue = currency(u.previous_amount_due || 0);
    const received = currency(u.amount_received || 0);
    const pending = currency(u.amount_pending || 0);
    const outstanding = currency(u.outstanding || 0);
    const outstandingColor = Number(u.outstanding) > 0 ? '#ef4444' : '#22c55e';

    html += `
      <tr>
        <td><strong>${itsId}</strong></td>
        <td><strong>${name}</strong></td>
        <td>${mobile}</td>
        <td>${sector}</td>
        <td style="text-align: right; font-weight: 600;">₹${billed}</td>
        <td style="text-align: right; color: #f59e0b; font-weight: 600;">₹${previousDue}</td>
        <td style="text-align: right; color: #22c55e; font-weight: 600;">₹${received}</td>
        <td style="text-align: right; color: #f59e0b; font-weight: 600;">₹${pending}</td>
        <td style="text-align: right; color: ${outstandingColor}; font-weight: 700;">₹${outstanding}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

async function showDetail(id) {
  const res = await fetch(`/api/admin/users/${id}`);
  if (!res.ok) return;
  const data = await res.json();

  document.getElementById('detailName').textContent = data.user.name;
  document.getElementById('detailMeta').textContent =
    `${data.user.its_id || data.user.sabil_no || 'N/A'} · ${data.user.mobile || 'no mobile'} · ${data.user.city || 'no city'} · Outstanding: ${currency(data.summary.outstanding)}`;

  const tbody = document.getElementById('detailBody');
  tbody.innerHTML = '';
  // Use takhmeen data (same as user page)
  const historyData = data.takhmeen || data.history || [];
  historyData.forEach((r) => {
    const tr = document.createElement('tr');
    // Handle both fmb_takhmeen format (takhmeen_yr, takhmeen_amt) and payment_records format (period_label, amount_billed)
    const period = r.takhmeen_yr || r.period_label || '-';
    const amount = r.takhmeen_amt || r.amount_billed || 0;
    const prevDue = r.previous_amount_due || 0;
    const paid = r.amount_paid || 0;
    const dueDate = r.due_date ? new Date(r.due_date).toLocaleDateString() : '-';
    const status = r.status || 'N/A';
    const notes = r.comment || r.notes || '-';

    tr.innerHTML = `
      <td>${escapeHtml(period)}</td>
      <td>${currency(amount)}</td>
      <td>${currency(prevDue)}</td>
      <td>${currency(paid)}</td>
      <td>${dueDate}</td>
      <td><span class="badge ${status}">${escapeHtml(status)}</span></td>
      <td>${escapeHtml(notes)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('detailPanel').style.display = 'block';
  document.getElementById('detailPanel').scrollIntoView({ behavior: 'smooth' });
}

async function handleCombinedUpload(e) {
  e.preventDefault();
  const resultEl = document.getElementById('combinedUploadResult');
  const submitBtn = e.target.querySelector('button');

  const files = droppedFiles['combinedFileInput'] || document.getElementById('combinedFileInput')?.files;

  if (!files || !files.length) {
    resultEl.textContent = '❌ Choose a file first.';
    resultEl.className = 'upload-result error';
    resultEl.style.display = 'block';
    return;
  }

  const formData = new FormData();
  formData.append('file', files[0]);

  resultEl.textContent = '⏳ Uploading combined FMB data...';
  resultEl.className = 'upload-result';
  resultEl.style.display = 'block';
  submitBtn.disabled = true;

  try {
    const res = await fetchWithTimeout('/api/admin/upload-combined', { method: 'POST', body: formData }, 60000);
    const data = await res.json();

    if (!res.ok) {
      resultEl.textContent = '❌ ' + (data.error || 'Upload failed.');
      resultEl.className = 'upload-result error';
      return;
    }

    let resultMessage = `✅ Upload completed successfully<br>📊 Summary:`;
    resultMessage += `<br>  • Records processed: ${data.summary.recordsProcessed}`;
    resultMessage += `<br>  • ITS updated/inserted: ${data.summary.itsUpserted}`;
    resultMessage += `<br>  • Takhmeen updated/inserted: ${data.summary.takhmeenUpserted}`;
    resultMessage += `<br>  • Payments updated/inserted: ${data.summary.paymentUpserted}`;
    resultMessage += `<br>  • Row errors: ${data.summary.rowErrors}`;

    if (data.warnings && data.warnings.length > 0) {
      resultMessage += `<br>⚠️ ${data.warnings.length} issue(s):`;
      data.warnings.forEach(warn => {
        resultMessage += `<br>  • ${escapeHtml(warn)}`;
      });
    }

    resultEl.innerHTML = resultMessage;
    resultEl.className = data.summary.rowErrors === 0 ? 'upload-result success' : 'upload-result warning';

    droppedFiles['combinedFileInput'] = null;
    const fileInput = document.getElementById('combinedFileInput');
    if (fileInput) fileInput.value = '';
  } catch (err) {
    resultEl.textContent = '❌ Network error during upload.';
    resultEl.className = 'upload-result error';
  } finally {
    submitBtn.disabled = false;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- Drag & Drop functionality ----------
// Store files globally for each drop zone
const droppedFiles = {};

function setupDragDrop(dropZoneId, fileInputId) {
  const dropZone = document.getElementById(dropZoneId);
  const fileInput = document.getElementById(fileInputId);

  if (!dropZone || !fileInput) return;

  // Initialize storage for this drop zone
  droppedFiles[fileInputId] = null;

  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      // Store the dropped files
      droppedFiles[fileInputId] = files;
      updateDropZoneDisplay(dropZone, files[0].name);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      // Store the selected files
      droppedFiles[fileInputId] = fileInput.files;
      updateDropZoneDisplay(dropZone, fileInput.files[0].name);
    }
  });

  function updateDropZoneDisplay(zone, fileName) {
    zone.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 32px; margin-bottom: 12px;">✅</div>
        <p style="margin: 0; font-weight: 600; color: var(--green);">File selected</p>
        <p style="margin: 0; color: var(--text-lighter); font-size: 13px;">${fileName}</p>
      </div>
    `;
  }
}

// Initialize drag-drop when page loads
if (document.getElementById('combinedDropZone')) {
  setupDragDrop('combinedDropZone', 'combinedFileInput');
}

// ========== NOTIFICATIONS SYSTEM ==========
const notificationForm = document.getElementById('notificationForm');
if (notificationForm) {
  notificationForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('notificationTitle').value.trim();
    const message = document.getElementById('notificationMessage').value.trim();
    const sendBtn = document.getElementById('sendNotificationBtn');
    const statusEl = document.getElementById('notificationStatus');
    const errorEl = document.getElementById('notificationError');
    const resultDiv = document.getElementById('notificationResult');

    if (!title || !message) {
      errorEl.textContent = '❌ Title and message are required';
      errorEl.style.display = 'block';
      statusEl.style.display = 'none';
      return;
    }

    sendBtn.disabled = true;
    const originalText = sendBtn.innerHTML;
    sendBtn.innerHTML = '<span class="loading-spinner"></span> Sending...';
    statusEl.style.display = 'none';
    errorEl.style.display = 'none';

    try {
      const res = await fetch('/api/notifications/admin/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, adminId: 'admin' })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send notification');
      }

      // Show success
      statusEl.textContent = `✅ ${data.message}`;
      statusEl.style.display = 'block';
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = `<p style="margin: 0; color: #16a34a; font-weight: 600;">✅ ${escapeHtml(data.message)}</p>`;

      // Clear form
      notificationForm.reset();

      // Reload notifications list
      loadRecentNotifications();

      // Hide success after 5 seconds
      setTimeout(() => {
        statusEl.style.display = 'none';
        resultDiv.style.display = 'none';
      }, 5000);
    } catch (err) {
      errorEl.textContent = `❌ ${err.message}`;
      errorEl.style.display = 'block';
      console.error('Notification error:', err);
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = originalText;
    }
  });

  // Load recent notifications on page load
  loadRecentNotifications();
}

async function loadRecentNotifications() {
  const notificationsList = document.getElementById('notificationsList');
  if (!notificationsList) return;

  try {
    const res = await fetch('/api/notifications/admin/all');
    const data = await res.json();

    if (!data.notifications || data.notifications.length === 0) {
      notificationsList.innerHTML = '<p style="color: var(--text-lighter); text-align: center; padding: 20px;">No notifications sent yet</p>';
      return;
    }

    notificationsList.innerHTML = data.notifications
      .slice(0, 10)
      .map((notif, index) => {
        const date = new Date(notif.created_at).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        return `
          <div style="border-bottom: 1px solid var(--border); padding: 12px 0; ${index === 0 ? 'border-top: 1px solid var(--border);' : ''}">
            <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">${notif.title}</div>
            <div style="color: var(--text-light); font-size: 13px; margin-bottom: 8px;">${notif.message.substring(0, 100)}${notif.message.length > 100 ? '...' : ''}</div>
            <div style="color: var(--text-lighter); font-size: 12px;">
              📅 ${date} • ${notif.is_active ? '✅ Active' : '⏸️ Inactive'}
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Failed to load notifications:', err);
    notificationsList.innerHTML = '<p style="color: #dc2626; padding: 20px;">Failed to load notifications</p>';
  }
}

// ========== ANALYTICS DASHBOARD ==========
async function loadAnalytics() {
  try {
    const res = await fetchWithTimeout('/api/app-analytics/stats');
    if (!res.ok) throw new Error('Failed to fetch analytics');

    const stats = await res.json();

    // Update stats
    document.getElementById('statInstallationsToday').textContent = stats.installationsToday || 0;
    document.getElementById('statTotalInstallations').textContent = stats.totalInstallations || 0;
    document.getElementById('statActiveUsers').textContent = stats.activeUsers24h || 0;

    // Render version distribution
    const versionDiv = document.getElementById('versionDistribution');
    if (stats.topVersions && stats.topVersions.length > 0) {
      const maxCount = Math.max(...stats.topVersions.map(v => v.count));
      versionDiv.innerHTML = stats.topVersions.map(v => {
        const percentage = Math.round((v.count / maxCount) * 100);
        return `
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <strong>v${v.app_version}</strong>
              <span style="color: #666; font-size: 12px;">${v.count} users (${Math.round((v.count / (stats.totalInstallations || 1)) * 100)}%)</span>
            </div>
            <div style="width: 100%; height: 24px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
              <div style="
                width: ${percentage}%;
                height: 100%;
                background: linear-gradient(90deg, #3c7441 0%, #5a9b62 100%);
                border-radius: 4px;
                transition: width 0.3s ease;
              "></div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      versionDiv.innerHTML = '<div style="color: #999; padding: 20px; text-align: center;">No data yet</div>';
    }

    // Render installation methods
    const methodsDiv = document.getElementById('installationMethods');
    if (stats.installationMethods && stats.installationMethods.length > 0) {
      methodsDiv.innerHTML = stats.installationMethods.map(m => {
        const icons = {
          'web': '🌐',
          'standalone': '📱',
          'iOS': '🍎',
          'Android': '🤖',
          'display-mode': '💻'
        };
        const icon = icons[m.detection_method] || '?';
        return `
          <div style="
            display: flex;
            align-items: center;
            padding: 12px;
            background: white;
            border-radius: 6px;
            margin-bottom: 8px;
            border-left: 4px solid #3c7441;
          ">
            <span style="font-size: 20px; margin-right: 12px;">${icon}</span>
            <div style="flex-grow: 1;">
              <strong style="text-transform: capitalize;">${m.detection_method}</strong>
              <div style="font-size: 12px; color: #999;">${m.count} users</div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      methodsDiv.innerHTML = '<div style="color: #999; padding: 20px; text-align: center;">No data yet</div>';
    }
  } catch (err) {
    console.error('Failed to load analytics:', err);
    document.getElementById('versionDistribution').innerHTML = '<p style="color: #dc2626; padding: 20px;">Failed to load analytics</p>';
  }
}

// Export analytics as CSV
async function exportAnalyticsCSV() {
  try {
    const startDate = document.getElementById('analyticsStartDate')?.value;
    const endDate = document.getElementById('analyticsEndDate')?.value;

    let url = '/api/app-analytics/export/csv';
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (params.toString()) url += '?' + params.toString();

    const res = await fetch(url);
    if (!res.ok) throw new Error('Export failed');

    // Create download link
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pwa-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Export error:', err);
    alert('Failed to export CSV: ' + err.message);
  }
}

// Generate analytics report
async function generateAnalyticsReport() {
  try {
    const startDate = document.getElementById('analyticsStartDate')?.value;
    const endDate = document.getElementById('analyticsEndDate')?.value;

    let url = '/api/app-analytics/report';
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (params.toString()) url += '?' + params.toString();

    const res = await fetch(url);
    if (!res.ok) throw new Error('Report generation failed');

    const report = await res.json();

    // Create report modal
    const modal = document.createElement('div');
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

    const trendHTML = report.trend.map(t => `
      <tr>
        <td>${t.date}</td>
        <td>${t.count}</td>
      </tr>
    `).join('');

    const groupedHTML = report.grouped.map(g => `
      <tr>
        <td>${g.category || 'N/A'}</td>
        <td>${g.count}</td>
      </tr>
    `).join('');

    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 32px; max-width: 800px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2 style="margin: 0;">📋 PWA Analytics Report</h2>
          <button onclick="this.closest('div').parentElement.remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 16px 0; color: #1a1a1a;">Summary</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div>
              <div style="font-size: 24px; font-weight: bold; color: #3c7441;">${report.summary.total_installs}</div>
              <div style="font-size: 12px; color: #666;">Total Installations</div>
            </div>
            <div>
              <div style="font-size: 24px; font-weight: bold; color: #0284c7;">${report.summary.unique_users}</div>
              <div style="font-size: 12px; color: #666;">Unique Users</div>
            </div>
            <div>
              <div style="font-size: 24px; font-weight: bold; color: #7c3aed;">${report.summary.days_with_installs}</div>
              <div style="font-size: 12px; color: #666;">Days with Activity</div>
            </div>
          </div>
          <div style="font-size: 12px; color: #999; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            Period: ${report.dateRange.startDate} to ${report.dateRange.endDate}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
          <div>
            <h3 style="margin: 0 0 12px 0; color: #1a1a1a;">Daily Trend (Last 30 Days)</h3>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <thead>
                <tr style="background: #f0f0f0;">
                  <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Date</th>
                  <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Count</th>
                </tr>
              </thead>
              <tbody>
                ${trendHTML}
              </tbody>
            </table>
          </div>

          <div>
            <h3 style="margin: 0 0 12px 0; color: #1a1a1a;">Version Distribution</h3>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <thead>
                <tr style="background: #f0f0f0;">
                  <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Version</th>
                  <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Count</th>
                </tr>
              </thead>
              <tbody>
                ${groupedHTML}
              </tbody>
            </table>
          </div>
        </div>

        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button onclick="window.print()" class="small" style="cursor: pointer;">🖨️ Print</button>
          <button onclick="this.closest('div').parentElement.remove()" class="secondary small" style="cursor: pointer;">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  } catch (err) {
    console.error('Report generation error:', err);
    alert('Failed to generate report: ' + err.message);
  }
}

// Load analytics when analytics tab is visible
window.addEventListener('load', () => {
  const refreshBtn = document.getElementById('refreshAnalytics');
  const exportBtn = document.getElementById('exportCsvAnalytics');
  const reportBtn = document.getElementById('generateReportAnalytics');
  const filterBtn = document.getElementById('applyDateFilter');

  if (refreshBtn) refreshBtn.addEventListener('click', loadAnalytics);
  if (exportBtn) exportBtn.addEventListener('click', exportAnalyticsCSV);
  if (reportBtn) reportBtn.addEventListener('click', generateAnalyticsReport);
  if (filterBtn) filterBtn.addEventListener('click', loadAnalytics);
});

