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
const usersBody = document.getElementById('usersBody');
if (usersBody) {
  init();
}

// Sorting state
let currentSortColumn = 'outstanding';
let sortDirection = 'desc';
let allUsers = [];

// Helper function for fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw error;
  }
}

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

  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleUpload);
    console.log('✓ Upload form listener attached');
  } else {
    console.error('❌ uploadForm element not found');
  }

  const paymentForm = document.getElementById('uploadPaymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', handlePaymentUpload);
    console.log('✓ Payment form listener attached');
  } else {
    console.warn('⚠️ uploadPaymentForm element not found');
  }

  document.getElementById('closeDetail').addEventListener('click', () => {
    document.getElementById('detailPanel').style.display = 'none';
  });

  await loadUsers();
}

function currency(n) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  statsRowEl.innerHTML = `
    <div class="stat">
      <div class="stat-icon">👥</div>
      <div class="label">Total Users</div>
      <div class="value">${safeUsers.totalUsers || 0}</div>
      <div class="change">Active accounts</div>
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
    errorEl.innerHTML = `<strong>Failed to load data:</strong> ${err.message}<br>
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
  tbody.innerHTML = '';

  users.forEach((u, index) => {
    const tr = document.createElement('tr');
    const itsId = escapeHtml(u.its_id || u.sabil_no || '-');
    const name = escapeHtml(u.name || '-');
    const mobile = escapeHtml(u.mobile || '-');
    const sector = escapeHtml(u.sector || '-');
    const billed = currency(u.total_billed || 0);
    const received = currency(u.amount_received || 0);
    const pending = currency(u.amount_pending || 0);
    const outstanding = currency(u.outstanding || 0);
    const outstandingColor = Number(u.outstanding) > 0 ? '#ef4444' : '#22c55e';

    tr.style.animation = `slideIn 0.3s ease-out ${index * 0.02}s`;
    tr.innerHTML = `
      <td><strong>${itsId}</strong></td>
      <td><strong>${name}</strong></td>
      <td>${mobile}</td>
      <td>${sector}</td>
      <td style="text-align: right; font-weight: 600;">₹${billed}</td>
      <td style="text-align: right; color: #22c55e; font-weight: 600;">₹${received}</td>
      <td style="text-align: right; color: #f59e0b; font-weight: 600;">₹${pending}</td>
      <td style="text-align: right; color: ${outstandingColor}; font-weight: 700;">₹${outstanding}</td>
    `;
    tbody.appendChild(tr);
  });
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
  data.history.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.period_label || '-')}</td>
      <td>${currency(r.amount_billed)}</td>
      <td>${currency(r.amount_paid)}</td>
      <td>${r.due_date ? new Date(r.due_date).toLocaleDateString() : '-'}</td>
      <td><span class="badge ${r.status}">${escapeHtml(r.status)}</span></td>
      <td>${escapeHtml(r.notes || '-')}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('detailPanel').style.display = 'block';
  document.getElementById('detailPanel').scrollIntoView({ behavior: 'smooth' });
}

async function handleUpload(e) {
  e.preventDefault();
  const resultEl = document.getElementById('uploadResult');
  const submitBtn = document.getElementById('uploadForm')?.querySelector('button');

  if (!resultEl) {
    console.error('uploadResult element not found');
    return;
  }

  // Check for stored dropped files or regular file input
  const files = droppedFiles['fileInput'] || document.getElementById('fileInput')?.files;

  if (!files || !files.length) {
    resultEl.textContent = '❌ Choose a file first.';
    resultEl.className = 'upload-result error';
    resultEl.style.display = 'block';
    console.warn('No files selected');
    return;
  }

  console.log('Files selected:', files[0].name);

  const formData = new FormData();
  formData.append('file', files[0]);

  resultEl.textContent = '⏳ Uploading...';
  resultEl.className = 'upload-result';
  resultEl.style.display = 'block';
  if (submitBtn) submitBtn.disabled = true;

  console.log('Starting upload...');

  try {
    const res = await fetchWithTimeout('/api/admin/upload', { method: 'POST', body: formData }, 60000);
    console.log('Upload response status:', res.status);
    const data = await res.json();
    console.log('Upload response data:', data);

    if (!res.ok) {
      resultEl.textContent = '❌ ' + (data.error || 'Upload failed.');
      resultEl.className = 'upload-result error';
      return;
    }

    const warnings = data.warnings && data.warnings.length ? ` (⚠️ ${data.warnings.length} rows skipped)` : '';
    resultEl.innerHTML = `✅ Success: ${data.usersUpserted} users updated, ${data.paymentsInserted} payment records added${warnings}`;
    resultEl.className = 'upload-result success';

    // Clear the stored files and reset the input
    droppedFiles['fileInput'] = null;
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';

    setTimeout(() => loadUsers(), 500);
  } catch (err) {
    resultEl.textContent = '❌ Network error during upload.';
    resultEl.className = 'upload-result error';
  } finally {
    submitBtn.disabled = false;
  }
}

async function handlePaymentUpload(e) {
  e.preventDefault();
  const resultEl = document.getElementById('paymentUploadResult');
  const submitBtn = e.target.querySelector('button');

  // Check for stored dropped files or regular file input
  const files = droppedFiles['paymentFileInput'] || document.getElementById('paymentFileInput')?.files;

  if (!files || !files.length) {
    resultEl.textContent = '❌ Choose a file first.';
    resultEl.className = 'upload-result error';
    resultEl.style.display = 'block';
    return;
  }

  const formData = new FormData();
  formData.append('file', files[0]);

  resultEl.textContent = '⏳ Uploading payments...';
  resultEl.className = 'upload-result';
  resultEl.style.display = 'block';
  submitBtn.disabled = true;

  try {
    const res = await fetchWithTimeout('/api/admin/upload-payments', { method: 'POST', body: formData }, 60000);
    const data = await res.json();

    if (!res.ok) {
      resultEl.textContent = '❌ ' + (data.error || 'Upload failed.');
      resultEl.className = 'upload-result error';
      return;
    }

    // Build result message from API response
    let resultMessage = `✅ ${data.summary.message}<br>💰 Total Received: ₹${data.summary.totalReceived}`;

    // Add processing summary
    resultMessage += `<br>📊 Processed: ${data.summary.recordsProcessed} records | Added: ${data.summary.newRecordsInserted} | Duplicates: ${data.summary.duplicatesSkipped}`;

    // Add warnings if any
    if (data.warnings && data.warnings.length > 0) {
      resultMessage += `<br>⚠️ ${data.warnings.length} warning(s)`;
    }

    resultEl.innerHTML = resultMessage;
    resultEl.className = data.paymentsInserted > 0 ? 'upload-result success' : (data.paymentsDuplicate > 0 ? 'upload-result warning' : 'upload-result error');

    // Clear the stored files and reset the input
    droppedFiles['paymentFileInput'] = null;
    const fileInput = document.getElementById('paymentFileInput');
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
if (document.getElementById('dropZone')) {
  setupDragDrop('dropZone', 'fileInput');
  console.log('✓ User data drop zone initialized');
} else {
  console.error('❌ dropZone element not found');
}

if (document.getElementById('paymentDropZone')) {
  setupDragDrop('paymentDropZone', 'paymentFileInput');
  console.log('✓ Payment drop zone initialized');
} else {
  console.warn('⚠️ paymentDropZone element not found');
}
