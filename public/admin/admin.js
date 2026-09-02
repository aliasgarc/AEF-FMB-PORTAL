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

// Escape HTML for security (from fetch-utils.js)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
    // Simple callback to log when updates are found (admin page can be extended with UI later)
    PWAUtils.startPeriodicUpdateCheck(APP_VERSION, me.admin.id, 'admin', 300000, (updateInfo) => {
      if (updateInfo.hasUpdate) {
        console.log(`[Admin] Update available: ${APP_VERSION} → ${updateInfo.currentVersion}`);
      }
    });
    // Track installation for analytics
    PWAUtils.trackInstallation(me.admin.id, APP_VERSION);
  }
}

// Get current filter values
function getActiveFilters() {
  const pendingFilter = document.querySelector('input[name="pendingFilter"]:checked');
  return {
    search: document.getElementById('userSearch')?.value || '',
    minAmount: document.getElementById('minAmountFilter')?.value || '0',
    maxAmount: document.getElementById('maxAmountFilter')?.value || '999999999',
    pendingScale: pendingFilter?.value || 'all'
  };
}

// Build API URL with filters
function buildUsersUrl() {
  const filters = getActiveFilters();
  const params = new URLSearchParams();

  if (filters.search) params.append('search', filters.search);
  if (filters.status) params.append('status', filters.status);
  if (filters.city) params.append('city', filters.city);
  if (filters.sector) params.append('sector', filters.sector);
  if (filters.minAmount) params.append('minAmount', filters.minAmount);
  if (filters.maxAmount) params.append('maxAmount', filters.maxAmount);

  return `/api/admin/users${params.toString() ? '?' + params.toString() : ''}`;
}

async function loadUsers() {
  try {
    // Fetch both user list and stats in parallel for better mobile performance
    const usersUrl = buildUsersUrl();
    const [usersRes, statsRes] = await Promise.all([
      fetchWithTimeout(usersUrl),
      fetchWithTimeout('/api/admin/stats')
    ]);

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
    // Handle pending percentage - convert to number, handle null/undefined
    const pendingPercent = (u.pending_percentage !== null && u.pending_percentage !== undefined)
      ? Number(u.pending_percentage).toFixed(1)
      : '0.0';
    const outstandingColor = Number(u.outstanding) > 0 ? '#ef4444' : '#22c55e';

    // Color code pending percentage
    let pendingPercentColor = '#22c55e';  // green for 0-25%
    if (pendingPercent > 25 && pendingPercent <= 50) pendingPercentColor = '#f59e0b';  // orange for 25-50%
    if (pendingPercent > 50 && pendingPercent <= 75) pendingPercentColor = '#ef8b45';  // orange-red for 50-75%
    if (pendingPercent > 75) pendingPercentColor = '#dc2626';  // red for 75-100%

    html += `
      <tr>
        <td style="text-align: left;"><strong>${itsId}</strong></td>
        <td style="text-align: left;"><strong>${name}</strong></td>
        <td style="text-align: left;">${mobile}</td>
        <td style="text-align: left;">${sector}</td>
        <td style="text-align: right; font-weight: 600;">₹${billed}</td>
        <td style="text-align: right; color: #f59e0b; font-weight: 600;">₹${previousDue}</td>
        <td style="text-align: right; color: #22c55e; font-weight: 600;">₹${received}</td>
        <td style="text-align: right; color: #f59e0b; font-weight: 600;">₹${pending}</td>
        <td style="text-align: right; color: ${pendingPercentColor}; font-weight: 700;">${pendingPercent}%</td>
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

async function checkJobStatus(jobId, isAutoCheck = false) {
  const resultEl = document.getElementById('combinedUploadResult');

  if (!resultEl) {
    console.error('Result element not found');
    return;
  }

  if (!jobId) {
    console.error('No job ID provided');
    resultEl.innerHTML = '❌ No job ID provided';
    resultEl.className = 'upload-result error';
    return;
  }

  try {
    // Add cache-buster to ensure fresh data
    const res = await fetch(`/api/admin/upload-status/${jobId}?t=${Date.now()}`);

    if (!res.ok) {
      const data = await res.json();
      resultEl.innerHTML = `❌ Could not check job status: ${data.error || 'Unknown error'}`;
      resultEl.className = 'upload-result error';
      return;
    }

    const data = await res.json();

    // Show progress bar while processing
    if (data.status === 'processing' || data.status === 'pending') {
      try {
        console.log(`\n📊 Status Check #${isAutoCheck ? 'auto' : 'initial'}:`);
        console.log(`   Raw progress: ${data.progress} (type: ${typeof data.progress})`);
        console.log(`   Status: ${data.status}`);

        const progress = Math.min(Math.max(parseInt(data.progress) || 0, 0), 100);
        console.log(`   Parsed progress: ${progress}%`);

        // Determine stage based on progress
        let stage = 'Initializing';
        let stageIcon = '📦';
        let stageDesc = 'Preparing file...';

        if (progress < 25) {
          stage = 'Validating';
          stageIcon = '🔍';
          stageDesc = 'Checking file format and data...';
        } else if (progress < 50) {
          stage = 'Parsing';
          stageIcon = '📄';
          stageDesc = 'Reading Excel data...';
        } else if (progress < 75) {
          stage = 'Processing';
          stageIcon = '⚙️';
          stageDesc = 'Validating and transforming records...';
        } else if (progress < 95) {
          stage = 'Saving';
          stageIcon = '💾';
          stageDesc = 'Writing to database...';
        } else {
          stage = 'Finalizing';
          stageIcon = '✨';
          stageDesc = 'Completing upload...';
        }

        // Create or update modal
        let modal = document.getElementById('upload-progress-modal');
        const isNewModal = !modal;

        if (isNewModal) {
          modal = document.createElement('div');
          modal.id = 'upload-progress-modal';
          document.body.appendChild(modal);
        }

        const circumference = 2 * Math.PI * 45;
        const offset = circumference - (progress / 100) * circumference;

        const progressHtml = `
          <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px);">
            <div style="text-align: center; padding: 32px; background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); max-width: 420px; width: 90%; animation: slideUp 0.4s ease-out;">

            <!-- Animated Header -->
            <div style="margin-bottom: 20px;">
              <div style="font-size: 36px; margin-bottom: 8px; display: inline-block;">
                <span style="animation: bounce 0.6s ease-in-out infinite, spin 2s linear infinite;">${stageIcon}</span>
              </div>
              <div style="margin-top: 6px;">
                <strong style="font-size: 18px; color: #2c3e50; letter-spacing: 0.3px;">${stage}</strong>
                <small style="display: block; color: #7f8c8d; margin-top: 2px; font-size: 10px;">Job #${jobId}</small>
              </div>
            </div>

            <!-- Circular Progress Indicator -->
            <div style="margin: 20px 0; position: relative; width: 140px; height: 140px; margin-left: auto; margin-right: auto;">
              <svg width="140" height="140" style="transform: rotate(-90deg);">
                <!-- Background circle -->
                <circle cx="70" cy="70" r="45" fill="none" stroke="#e8e8e8" stroke-width="8" />
                <!-- Progress circle -->
                <circle cx="70" cy="70" r="45" fill="none" stroke="url(#progressGradient)" stroke-width="8"
                  stroke-dasharray="${circumference}"
                  stroke-dashoffset="${offset}"
                  stroke-linecap="round"
                  style="transition: stroke-dashoffset 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);" />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#4CAF50;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#45a049;stop-opacity:1" />
                  </linearGradient>
                </defs>
              </svg>
              <!-- Center percentage text -->
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                <div style="font-size: 42px; font-weight: bold; color: #4CAF50; line-height: 1;">${progress}<span style="font-size: 24px;">%</span></div>
              </div>
            </div>

            <!-- Dynamic Description -->
            <div style="margin: 12px 0; min-height: 30px;">
              <small style="color: #666; display: block; font-size: 12px; font-weight: 500; line-height: 1.5;">
                ${stageDesc}
              </small>
            </div>

            <!-- Animated Stage Indicators with Connectors -->
            <div style="position: relative; margin: 20px 0;">
              <!-- Connecting Line -->
              <div style="position: absolute; top: 16px; left: 8%; right: 8%; height: 2px; background: linear-gradient(90deg, #e0e0e0 0%, #4CAF50 ${progress}%, #e0e0e0 ${progress}%); z-index: 0; border-radius: 1px;"></div>

              <!-- Stage Circles -->
              <div style="display: flex; justify-content: space-around; position: relative; z-index: 1; gap: 4px;">
                ${[
                  { threshold: 0, label: 'Validate', icon: '1️⃣' },
                  { threshold: 25, label: 'Parse', icon: '2️⃣' },
                  { threshold: 50, label: 'Process', icon: '3️⃣' },
                  { threshold: 75, label: 'Save', icon: '4️⃣' },
                  { threshold: 95, label: 'Finalize', icon: '5️⃣' }
                ].map((step, idx) => {
                  const isActive = progress >= step.threshold;
                  const isCompleted = progress > step.threshold + 10;
                  return `
                    <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                      <div style="
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        background: ${isCompleted ? '#4CAF50' : isActive ? '#FFD700' : '#e0e0e0'};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 14px;
                        margin-bottom: 4px;
                        transition: all 0.4s ease;
                        box-shadow: ${isActive ? '0 0 10px rgba(76, 175, 80, 0.5)' : 'none'};
                        animation: ${isActive ? 'pulse-glow 1.5s ease-in-out infinite' : 'none'};
                      ">
                        ${isCompleted ? '✅' : step.icon}
                      </div>
                      <small style="color: ${isActive ? '#4CAF50' : '#999'}; font-size: 10px; font-weight: 600; text-align: center;">${step.label}</small>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Timer Animation -->
            <small style="color: #999; font-size: 11px; display: block; margin-top: 14px;">
              <span style="animation: blink 1.5s infinite;">⏱️</span> Typically 30-60 seconds
            </small>
          </div>

          <style>
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-8px); }
            }

            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }

            @keyframes slide {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }

            @keyframes pulse-glow {
              0%, 100% {
                box-shadow: 0 0 12px rgba(76, 175, 80, 0.6);
                transform: scale(1);
              }
              50% {
                box-shadow: 0 0 20px rgba(76, 175, 80, 0.9);
                transform: scale(1.05);
              }
            }

            @keyframes fadeInOut {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }

            @keyframes blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }

            @keyframes scaleIn {
              from {
                transform: scale(0.95);
                opacity: 0;
              }
              to {
                transform: scale(1);
                opacity: 1;
              }
            }
          </style>
            </div>
          </div>
        `;

        // Only update innerHTML if modal is new or content changed
        if (isNewModal || modal.innerHTML !== progressHtml) {
          modal.innerHTML = progressHtml;
        }
        modal.style.display = 'block';
      } catch (err) {
        console.error('Progress display error:', err);
        resultEl.innerHTML = `⏳ ${data.status === 'processing' ? 'Processing' : 'Queued'} (Job ID: ${jobId})`;
        resultEl.className = 'upload-result';
        resultEl.style.display = 'block';
      }

      // Auto-check again after 2 seconds
      setTimeout(() => checkJobStatus(jobId, true), 2000);
      return;
    }

    // Handle completion/failure in modal
    const modal = document.getElementById('upload-progress-modal');

    if (data.status === 'completed') {
      // Show completion message in modal
      let completionHtml = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px);">
          <div style="text-align: center; padding: 40px 32px; background: linear-gradient(135deg, #ffffff 0%, #f0f9f7 100%); border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); max-width: 420px; width: 90%; animation: slideUp 0.4s ease-out;">
            <div style="font-size: 56px; margin-bottom: 16px; animation: bounce 0.6s ease-in-out;">✅</div>
            <strong style="font-size: 22px; color: #27ae60; display: block; margin-bottom: 6px;">Upload Completed!</strong>
            <small style="color: #7f8c8d; font-size: 12px; display: block; margin-bottom: 20px;">Job #${jobId}</small>

            ${data.summary ? `
              <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; text-align: left; margin-bottom: 16px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0;">
                  <span>📋 Records Processed:</span>
                  <strong>${data.summary.recordsProcessed}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0;">
                  <span>👥 Users:</span>
                  <strong>${data.summary.itsUpserted}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0;">
                  <span>💰 Takhmeen:</span>
                  <strong>${data.summary.takhmeenUpserted}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0;">
                  <span>💳 Payments:</span>
                  <strong>${data.summary.paymentUpserted}</strong>
                </div>
                ${data.summary.rowErrors > 0 ? `
                  <div style="display: flex; justify-content: space-between; color: #e74c3c;">
                    <span>⚠️ Errors:</span>
                    <strong>${data.summary.rowErrors}</strong>
                  </div>
                ` : ''}
              </div>
            ` : ''}

            <small style="color: #95a5a6; font-size: 11px; display: block;">Loading dashboard...</small>
          </div>
        </div>
        <style>
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes bounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
        </style>
      `;

      if (modal) {
        modal.innerHTML = completionHtml;
        modal.style.display = 'block';
      } else {
        const newModal = document.createElement('div');
        newModal.id = 'upload-progress-modal';
        newModal.innerHTML = completionHtml;
        document.body.appendChild(newModal);
      }

      // Reload dashboard after 2 seconds
      setTimeout(() => {
        window.location.href = '/admin/dashboard.html';
      }, 2000);
    } else if (data.status === 'failed') {
      // Show error in modal
      let errorHtml = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px);">
          <div style="text-align: center; padding: 40px 32px; background: linear-gradient(135deg, #ffffff 0%, #fef5f5 100%); border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); max-width: 420px; width: 90%; animation: slideUp 0.4s ease-out;">
            <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
            <strong style="font-size: 20px; color: #e74c3c; display: block; margin-bottom: 12px;">Upload Failed</strong>
            <p style="color: #7f8c8d; font-size: 13px; margin-bottom: 16px; line-height: 1.5;">${escapeHtml(data.error || 'Unknown error occurred')}</p>
            <small style="color: #95a5a6; font-size: 11px; display: block;">Job #${jobId}</small>
            <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 20px; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">Try Again</button>
          </div>
        </div>
        <style>
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        </style>
      `;

      if (modal) {
        modal.innerHTML = errorHtml;
        modal.style.display = 'block';
      } else {
        const newModal = document.createElement('div');
        newModal.id = 'upload-progress-modal';
        newModal.innerHTML = errorHtml;
        document.body.appendChild(newModal);
      }
    }
  } catch (err) {
    console.error('Job status check error:', err);
    resultEl.innerHTML = `❌ Error checking job status: ${err.message || 'Unknown error'}`;
    resultEl.className = 'upload-result error';
    resultEl.style.display = 'block';
  }
}

async function handleCombinedUpload(e) {
  e.preventDefault();

  const resultEl = document.getElementById('combinedUploadResult');
  const submitBtn = e.target.querySelector('button');
  const files = droppedFiles['combinedFileInput'] || document.getElementById('combinedFileInput')?.files;

  if (!files || !files.length) {
    resultEl.innerHTML = '❌ Choose a file first.';
    resultEl.className = 'upload-result error';
    resultEl.style.display = 'block';
    return;
  }

  const formData = new FormData();
  formData.append('file', files[0]);

  resultEl.innerHTML = '⏳ Uploading...';
  resultEl.className = 'upload-result';
  resultEl.style.display = 'block';
  submitBtn.disabled = true;

  try {
    console.log('🚀 UPLOAD START');
    console.log('   File:', files[0].name);
    console.log('   Size:', files[0].size, 'bytes');

    console.log('\n📤 Sending fetch request to /api/admin/upload-combined...');

    // Detect if on mobile for longer timeout
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const timeoutMs = isMobile ? 300000 : 120000; // 5 minutes for mobile, 2 minutes for desktop
    console.log(`   Timeout: ${timeoutMs}ms (${isMobile ? 'Mobile' : 'Desktop'})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch('/api/admin/upload-combined', {
        method: 'POST',
        body: formData,
        credentials: 'include',  // IMPORTANT: Include cookies
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        console.error('\n❌ TIMEOUT ERROR: Upload took longer than ' + timeoutMs + 'ms');
        resultEl.innerHTML = `❌ Upload timed out. Network may be slow or file too large. Please try again.`;
        resultEl.className = 'upload-result error';
        submitBtn.disabled = false;
        return;
      }
      console.error('\n❌ NETWORK ERROR:', fetchErr.message);
      resultEl.innerHTML = `❌ Network error: ${fetchErr.message || 'Could not connect to server'}`;
      resultEl.className = 'upload-result error';
      submitBtn.disabled = false;
      return;
    }

    console.log('\n📨 Response received');
    console.log('   Status:', response.status, response.statusText);
    console.log('   Content-Type:', response.headers.get('content-type'));

    if (!response.ok) {
      console.error('\n❌ Response Status Error:', response.status);
      try {
        const errorData = await response.text();
        console.error('   Response text:', errorData.substring(0, 200));
        const data = JSON.parse(errorData);
        resultEl.innerHTML = `❌ Error: ${data.error || 'Upload failed (HTTP ' + response.status + ')'}`;
      } catch (e) {
        resultEl.innerHTML = `❌ Server error: ${response.status} ${response.statusText}`;
      }
      resultEl.className = 'upload-result error';
      submitBtn.disabled = false;
      return;
    }

    let data;
    try {
      const responseText = await response.text();
      console.log('   Response length:', responseText.length);
      console.log('   Response preview:', responseText.substring(0, 100));

      data = JSON.parse(responseText);
      console.log('\n✅ Response parsed successfully');
      console.log('   jobId:', data.jobId);
      console.log('   status:', data.status);
    } catch (parseErr) {
      console.error('\n❌ JSON Parse Error:', parseErr.message);
      resultEl.innerHTML = `❌ Invalid response from server`;
      resultEl.className = 'upload-result error';
      submitBtn.disabled = false;
      return;
    }

    if (!data.jobId) {
      console.error('\n❌ Missing jobId in response:', data);
      resultEl.innerHTML = `❌ Invalid response: missing jobId`;
      resultEl.className = 'upload-result error';
      submitBtn.disabled = false;
      return;
    }

    console.log('\n🎉 UPLOAD SUCCESSFUL');
    console.log('   Job ID:', data.jobId);

    droppedFiles['combinedFileInput'] = null;
    const fileInput = document.getElementById('combinedFileInput');
    if (fileInput) fileInput.value = '';

    console.log('\n📊 Starting status check...');
    checkJobStatus(data.jobId);

  } catch (err) {
    console.error('\n❌ FETCH ERROR');
    console.error('   Type:', err.name);
    console.error('   Message:', err.message);
    console.error('   Stack:', err.stack);

    resultEl.innerHTML = `❌ Network error: ${err.message}`;
    resultEl.className = 'upload-result error';
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
          <div style="margin-bottom: 16px;">
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; align-items: center;">
              <strong style="font-size: 14px;">v${v.app_version}</strong>
              <span style="color: #666; font-size: 11px; word-break: break-word;">${v.count} users (${Math.round((v.count / (stats.totalInstallations || 1)) * 100)}%)</span>
            </div>
            <div style="width: 100%; height: 22px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
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
            padding: 12px 10px;
            background: white;
            border-radius: 6px;
            margin-bottom: 8px;
            border-left: 4px solid #3c7441;
            word-break: break-word;
          ">
            <span style="font-size: 18px; margin-right: 10px; flex-shrink: 0;">${icon}</span>
            <div style="flex-grow: 1; min-width: 0;">
              <strong style="text-transform: capitalize; font-size: 14px; display: block;">${m.detection_method}</strong>
              <div style="font-size: 11px; color: #999; margin-top: 2px;">${m.count} users</div>
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

  // Search and filter event listeners
  const userSearch = document.getElementById('userSearch');
  const minAmountFilter = document.getElementById('minAmountFilter');
  const maxAmountFilter = document.getElementById('maxAmountFilter');
  const pendingRadios = document.querySelectorAll('input[name="pendingFilter"]');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  const exportUsersCsvBtn = document.getElementById('exportBtn');

  // Real-time search
  if (userSearch) {
    userSearch.addEventListener('input', (e) => {
      clearTimeout(userSearch._debounceTimer);
      userSearch._debounceTimer = setTimeout(() => loadUsers(), 300);
    });
  }

  // Pending percentage filter changes
  pendingRadios.forEach(radio => {
    radio.addEventListener('change', loadUsers);
  });

  // Amount range filter changes
  if (minAmountFilter) minAmountFilter.addEventListener('change', loadUsers);
  if (maxAmountFilter) maxAmountFilter.addEventListener('change', loadUsers);

  // Clear all filters
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      if (userSearch) userSearch.value = '';
      if (minAmountFilter) minAmountFilter.value = '0';
      if (maxAmountFilter) maxAmountFilter.value = '999999999';
      const pendingAllRadio = document.getElementById('pendingAll');
      if (pendingAllRadio) pendingAllRadio.checked = true;
      loadUsers();
    });
  }

  // Export filtered users as CSV
  if (exportUsersCsvBtn) {
    exportUsersCsvBtn.addEventListener('click', () => {
      const params = new URLSearchParams(getActiveFilters());
      window.location.href = `/api/admin/users/export/csv${params.toString() ? '?' + params.toString() : ''}`;
    });
  }

  // Push Notifications Functionality
  setupPushNotifications();
});

function setupPushNotifications() {
  const form = document.getElementById('pushNotificationForm');
  const recipientTypeRadios = document.querySelectorAll('input[name="recipientType"]');
  const messageTypeRadios = document.querySelectorAll('input[name="messageType"]');
  const specificUsersDiv = document.getElementById('specificUsersDiv');
  const customMessageDiv = document.getElementById('customMessageDiv');
  const autoMessagePreview = document.getElementById('autoMessagePreview');
  const previewText = document.getElementById('previewText');
  const resultDiv = document.getElementById('pushResult');
  const loadHistoryBtn = document.getElementById('loadPushHistory');

  // Toggle specific users input and handle bulk_pending
  recipientTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const value = e.target.value;
      specificUsersDiv.style.display = value === 'specific' ? 'block' : 'none';

      // For bulk_pending, auto-select auto_pending message type and title
      if (value === 'bulk_pending') {
        document.querySelector('input[name="messageType"][value="auto_pending"]').checked = true;
        // Auto-populate title
        const titleField = document.getElementById('pushTitle');
        titleField.value = '💳 Payment Reminder';
        // Update preview
        updateMessagePreview('auto_pending');
        // Show custom message only if different type is selected later
        customMessageDiv.style.display = 'none';
        autoMessagePreview.style.display = 'block';
      }
    });
  });

  // Toggle message type UI and auto-populate title
  messageTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isCustom = e.target.value === 'custom';
      const messageType = e.target.value;
      customMessageDiv.style.display = isCustom ? 'block' : 'none';
      autoMessagePreview.style.display = isCustom ? 'none' : 'block';

      // Auto-populate title for auto message types
      const titleField = document.getElementById('pushTitle');
      if (!isCustom) {
        const autoTitles = {
          'auto_takhmeen': '💰 Takhmeen Update',
          'auto_pending': '💳 Payment Reminder',
          'bulk_pending': '💳 Payment Reminder'
        };
        titleField.value = autoTitles[messageType] || 'Notification';
        updateMessagePreview(messageType);
      }
    });
  });

  // Update preview for auto message types
  function updateMessagePreview(type) {
    const previewMessages = {
      'auto_takhmeen': '₹126,792.00',
      'auto_pending': '₹0.00',
      'bulk_pending': '₹0.00 (per user)'
    };

    let label;
    if (type === 'auto_takhmeen') {
      label = 'Your Takhmeen: ';
    } else if (type === 'bulk_pending') {
      label = 'Pending Payment: ';
    } else {
      label = 'Pending Payment: ';
    }
    previewText.textContent = label + previewMessages[type];
  }

  // Handle form submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      resultDiv.style.display = 'none';

      const recipientType = document.querySelector('input[name="recipientType"]:checked').value;
      const messageType = document.querySelector('input[name="messageType"]:checked').value;
      const title = document.getElementById('pushTitle').value;
      const customMessage = document.getElementById('pushMessage').value;

      // Validation
      if (!title.trim()) {
        showResult('❌ Please enter a notification title', 'error');
        return;
      }

      if (messageType === 'custom' && !customMessage.trim()) {
        showResult('❌ Please enter a message for custom type', 'error');
        return;
      }

      if (recipientType === 'specific') {
        const itsIds = document.getElementById('pushUserIds').value
          .split('\n')
          .map(id => id.trim())
          .filter(id => id);

        if (itsIds.length === 0) {
          showResult('❌ Please enter at least one user ITS ID', 'error');
          return;
        }
      }

      try {
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Sending...';

        const payload = {
          recipient_type: recipientType,
          message_type: messageType,
          title: title,
          admin_id: document.getElementById('whoami')?.textContent || 'admin'
        };

        if (messageType === 'custom') {
          payload.custom_message = customMessage;
        }

        if (recipientType === 'specific') {
          payload.its_ids = document.getElementById('pushUserIds').value
            .split('\n')
            .map(id => id.trim())
            .filter(id => id);
        }

        const response = await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.success) {
          showResult(`✅ Push notification sent to ${data.details.recipient_count} users!`, 'success');
          form.reset();
          specificUsersDiv.style.display = 'none';
          customMessageDiv.style.display = 'block';
          autoMessagePreview.style.display = 'none';

          // Reload history if it's shown
          const historyDiv = document.getElementById('pushHistory');
          if (historyDiv.style.display !== 'none') {
            loadPushHistoryData();
          }
        } else {
          const errorMsg = data.detail || data.error || 'Failed to send notification';
          showResult(`❌ ${errorMsg}`, 'error');
        }

        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      } catch (err) {
        showResult(`❌ Error: ${err.message}`, 'error');
      }
    });
  }

  // Load history
  if (loadHistoryBtn) {
    loadHistoryBtn.addEventListener('click', loadPushHistoryData);
  }

  function showResult(message, type) {
    resultDiv.textContent = message;
    resultDiv.style.display = 'block';
    resultDiv.style.background = type === 'success' ? '#e8f5e9' : '#ffebee';
    resultDiv.style.color = type === 'success' ? '#2e7d32' : '#c62828';
    resultDiv.style.border = `1px solid ${type === 'success' ? '#81c784' : '#e57373'}`;
  }
}

async function loadPushHistoryData() {
  try {
    const response = await fetch('/api/push/history');
    const data = await response.json();

    if (data.notifications && data.notifications.length > 0) {
      const historyDiv = document.getElementById('pushHistory');
      const historyBody = document.getElementById('pushHistoryBody');

      historyBody.innerHTML = data.notifications.map(notif => `
        <tr style="border-bottom: 1px solid var(--border); hover: background: #f8fafc;">
          <td style="padding: 12px;">${notif.title}</td>
          <td style="padding: 12px;">
            ${notif.message_type === 'custom' ? '✍️ Custom' : notif.message_type === 'auto_takhmeen' ? '💰 Takhmeen' : '⚠️ Pending'}
          </td>
          <td style="padding: 12px; text-align: center;">${notif.recipient_count}</td>
          <td style="padding: 12px; text-align: center;">${notif.delivered_count || 0}</td>
          <td style="padding: 12px;">${notif.created_by}</td>
          <td style="padding: 12px;">${new Date(notif.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');

      historyDiv.style.display = 'block';
      document.getElementById('pushResult').style.display = 'none';
    } else {
      document.getElementById('pushResult').style.display = 'block';
      document.getElementById('pushResult').textContent = '📭 No push notifications sent yet';
      document.getElementById('pushResult').style.background = '#e3f2fd';
      document.getElementById('pushResult').style.color = '#1565c0';
    }
  } catch (err) {
    console.error('Error loading history:', err);
    document.getElementById('pushResult').style.display = 'block';
    document.getElementById('pushResult').textContent = '❌ Failed to load history';
    document.getElementById('pushResult').style.background = '#ffebee';
    document.getElementById('pushResult').style.color = '#c62828';
  }
}

